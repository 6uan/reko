/**
 * Fetch + persist Strava's "detail" payload for a single activity:
 *   - best_efforts (1k, 1mi, 5k, 10k, Half-Marathon, Marathon splits w/ PR ranks)
 *   - streams (per-second time/distance/HR/cadence/altitude/pace arrays)
 *
 * Idempotent: re-running just refreshes the existing rows. Each Strava
 * best_effort has its own stable id; streams are keyed by (activity, type).
 *
 * Caller responsibility:
 *   - Hand in a fresh access token (use withFreshToken).
 *   - Track the 2 API calls this consumes against Strava's
 *     100-per-15-min / 1000-per-day budgets. The detail-fetch worker
 *     (Chunk 1.2.b) does that accounting.
 *
 * Errors:
 *   - StravaRateLimitedError surfaces 429s with Retry-After. Callers
 *     should pause until the next window rather than treating as fatal.
 *   - Other fetch failures throw — caller decides retry / skip / abort.
 *   - DB writes throw on constraint violations (shouldn't happen given
 *     ON CONFLICT, but propagate if they do).
 */

import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../db/client'
import {
  activities,
  bestEfforts,
  streams,
  type NewBestEffort,
  type NewStream,
} from '../../db/schema'
import {
  fetchActivityDetail,
  fetchActivityStreams,
  STRAVA_STREAM_TYPES,
  type StravaBestEffort,
  type StravaStreamSet,
} from '../../lib/strava'

export type StoreDetailResult = {
  /** How many best_effort rows were upserted (0 for short activities). */
  bestEffortCount: number
  /** How many stream channels were upserted (0 if Strava had none). */
  streamCount: number
  /** Strava API calls this invocation consumed. Always 2. */
  callsUsed: number
}

export async function storeActivityDetail(
  accessToken: string,
  userId: number,
  activityId: number,
): Promise<StoreDetailResult> {
  const db = getDb()

  // Both endpoints are independent — fire in parallel to halve wall time.
  // If either throws (incl. StravaRateLimitedError), Promise.all rejects
  // immediately and we don't write a partial result.
  const [detail, streamSet] = await Promise.all([
    fetchActivityDetail(accessToken, activityId),
    fetchActivityStreams(accessToken, activityId),
  ])

  const bestEffortRows = mapBestEfforts(detail.best_efforts ?? [], {
    userId,
    activityId,
  })
  const streamRows = mapStreams(streamSet, activityId)

  // ── best_efforts upsert ─────────────────────────────────────────────
  if (bestEffortRows.length > 0) {
    await db
      .insert(bestEfforts)
      .values(bestEffortRows)
      .onConflictDoUpdate({
        target: bestEfforts.id,
        set: {
          // Only the mutable fields. id / activityId / userId / name /
          // distance / startDateLocal don't change for a given effort.
          elapsedTime: sql`excluded.elapsed_time`,
          movingTime: sql`excluded.moving_time`,
          prRank: sql`excluded.pr_rank`,
        },
      })
  }

  // ── streams upsert ──────────────────────────────────────────────────
  if (streamRows.length > 0) {
    await db
      .insert(streams)
      .values(streamRows)
      .onConflictDoUpdate({
        // Unique index `streams_activity_type_uidx` is the conflict target.
        target: [streams.activityId, streams.streamType],
        set: {
          data: sql`excluded.data`,
          resolution: sql`excluded.resolution`,
          fetchedAt: sql`now()`,
        },
      })
  }

  // Mark the activity as detail-synced so the worker can skip it next run.
  // The summary backfill also bumps syncedAt — that's fine, this row is
  // monotonic and either source of "fresh" is correct.
  await db
    .update(activities)
    .set({ syncedAt: new Date() })
    .where(eq(activities.id, activityId))

  return {
    bestEffortCount: bestEffortRows.length,
    streamCount: streamRows.length,
    callsUsed: 2,
  }
}

// ── Pure mappers (no DB / no network) ────────────────────────────────────

function mapBestEfforts(
  efforts: StravaBestEffort[],
  ctx: { userId: number; activityId: number },
): NewBestEffort[] {
  return efforts.map((e) => ({
    id: e.id,
    activityId: ctx.activityId,
    userId: ctx.userId,
    name: e.name,
    distance: e.distance,
    elapsedTime: e.elapsed_time,
    movingTime: e.moving_time,
    // Pass-through string into `timestamp without time zone` — same
    // pattern as activities.startDateLocal. See mapStravaActivity.ts
    // for the wall-clock-preservation rationale.
    startDateLocal: e.start_date_local,
    prRank: e.pr_rank,
  }))
}

function mapStreams(
  streamSet: StravaStreamSet,
  activityId: number,
): NewStream[] {
  // Iterate the known type list (not Object.entries) so the row's
  // streamType is type-narrowed to the DB enum without casting.
  const rows: NewStream[] = []
  for (const type of STRAVA_STREAM_TYPES) {
    const stream = streamSet[type]
    if (!stream) continue
    rows.push({
      activityId,
      streamType: type,
      data: stream.data,
      resolution: stream.resolution ?? null,
    })
  }
  return rows
}
