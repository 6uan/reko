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
import { getDb } from '@/db/client'
import {
  activities,
  bestEfforts,
  derivedBestEfforts,
  hrZoneEfforts,
  streams,
  type NewBestEffort,
  type NewDerivedBestEffort,
  type NewHrZoneEffort,
  type NewStream,
} from '@/db/schema'
import {
  fetchActivityDetail,
  fetchActivityStreams,
  STRAVA_STREAM_TYPES,
  type StravaBestEffort,
  type StravaStreamSet,
} from '@/lib/strava'
import { computeBestEfforts, SPLIT_DISTANCES } from '@/lib/streams'
import { computeHrZoneEfforts } from '@/lib/heartRate'

export type StoreDetailResult = {
  /** How many best_effort rows were upserted (0 for short activities). */
  bestEffortCount: number
  /** How many derived (stream-computed) best-effort rows were upserted. */
  derivedBestEffortCount: number
  /** How many hr-zone effort rows were upserted (0 if no HR stream / no sustained window). */
  hrZoneEffortCount: number
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

  // ── derived best_efforts upsert ─────────────────────────────────────
  // Compute splits from the (distance, time) streams we just fetched, so
  // every applicable distance has a value even when Strava omits them.
  const derivedRows = mapDerivedBestEfforts(streamSet, { userId, activityId })
  if (derivedRows.length > 0) {
    await db
      .insert(derivedBestEfforts)
      .values(derivedRows)
      .onConflictDoUpdate({
        target: [derivedBestEfforts.activityId, derivedBestEfforts.name],
        set: {
          elapsedTime: sql`excluded.elapsed_time`,
          distance: sql`excluded.distance`,
          computedAt: sql`now()`,
        },
      })
  }

  // ── hr_zone_efforts upsert ──────────────────────────────────────────
  // Best sustained pace per HR zone, derived from heartrate / distance /
  // time streams over the default sustained window.
  const hrRows = mapHrZoneEfforts(streamSet, { userId, activityId })
  if (hrRows.length > 0) {
    await db
      .insert(hrZoneEfforts)
      .values(hrRows)
      .onConflictDoUpdate({
        target: [
          hrZoneEfforts.activityId,
          hrZoneEfforts.zoneName,
          hrZoneEfforts.windowSeconds,
        ],
        set: {
          paceSecondsPerKm: sql`excluded.pace_seconds_per_km`,
          computedAt: sql`now()`,
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
    derivedBestEffortCount: derivedRows.length,
    hrZoneEffortCount: hrRows.length,
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

function mapDerivedBestEfforts(
  streamSet: StravaStreamSet,
  ctx: { userId: number; activityId: number },
): NewDerivedBestEffort[] {
  // `distance` and `time` are scalar streams (number[]). The union type on
  // `data` exists so `latlng` can be [number, number][]; narrow here.
  const distance = streamSet.distance?.data as number[] | undefined
  const time = streamSet.time?.data as number[] | undefined
  if (!distance || !time) return []
  const efforts = computeBestEfforts(distance, time)
  const distanceByName = new Map(SPLIT_DISTANCES.map((d) => [d.key, d.meters]))
  const rows: NewDerivedBestEffort[] = []
  for (const [name, elapsedTime] of Object.entries(efforts)) {
    if (elapsedTime === undefined) continue
    rows.push({
      activityId: ctx.activityId,
      userId: ctx.userId,
      name,
      distance: distanceByName.get(name as keyof typeof efforts) ?? 0,
      elapsedTime: Math.round(elapsedTime),
    })
  }
  return rows
}

function mapHrZoneEfforts(
  streamSet: StravaStreamSet,
  ctx: { userId: number; activityId: number },
): NewHrZoneEffort[] {
  const distance = streamSet.distance?.data as number[] | undefined
  const time = streamSet.time?.data as number[] | undefined
  const heartrate = streamSet.heartrate?.data as number[] | undefined
  if (!distance || !time || !heartrate) return []
  const efforts = computeHrZoneEfforts(distance, time, heartrate)
  const rows: NewHrZoneEffort[] = []
  for (const [zoneName, byWindow] of Object.entries(efforts)) {
    if (!byWindow) continue
    for (const [windowSec, paceSecondsPerKm] of Object.entries(byWindow)) {
      rows.push({
        activityId: ctx.activityId,
        userId: ctx.userId,
        zoneName,
        windowSeconds: Number(windowSec),
        paceSecondsPerKm,
      })
    }
  }
  return rows
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
