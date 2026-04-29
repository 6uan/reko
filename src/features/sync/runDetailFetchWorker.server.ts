/**
 * Detail-fetch worker — iterates a user's activities and pulls
 * best_efforts + streams from Strava for each, storing via
 * storeActivityDetail.
 *
 * Public API:
 *   enqueueDetailFetch(userId)
 *     → inserts a sync_log row with kind='detail' (so polling can see it),
 *       fires the worker fire-and-forget. Idempotent: skips if a 'detail'
 *       sync is already running for this user.
 *
 * Sequencing vs the summary backfill:
 *   - Auto-triggered by backfillActivities at the end of a successful
 *     summary sync. Runs in the background; the SyncBanner only tracks
 *     summary backfills (see getSyncStatus filtering on kind='backfill').
 *   - The user can also trigger this manually (later — not wired yet).
 *
 * Rate-limit handling:
 *   Strava enforces 100 calls / 15min. Each activity costs 2 calls
 *   (detail + streams). So ~50 activities per window. When we hit 429,
 *   StravaRateLimitedError surfaces with a Retry-After hint; we sleep
 *   that long (default 15min if absent) and retry the SAME activity.
 *   The worker's progress is durable in the DB — even if the Node
 *   process restarts, the next worker run will pick up where we left off
 *   (any activity with detailSyncedAt = NULL).
 */

import { and, asc, eq, isNull } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { activities, syncLog } from '../../db/schema'
import { publish } from '../../lib/eventBus'
import { StravaRateLimitedError } from '../../lib/strava'
import { storeActivityDetail } from './storeActivityDetail.server'
import { withFreshToken } from './withFreshToken.server'

/** Default pause when Strava sends a 429 without a Retry-After header. */
const DEFAULT_RETRY_AFTER_MS = 15 * 60 * 1000

export type EnqueueDetailResult = {
  syncLogId: number | null
  alreadyRunning: boolean
}

export async function enqueueDetailFetch(
  userId: number,
): Promise<EnqueueDetailResult> {
  const db = getDb()

  // Idempotency: don't double-run. A previous detail sync still in flight
  // will eventually finish and pick up any straggler activities.
  const [active] = await db
    .select({ id: syncLog.id })
    .from(syncLog)
    .where(
      and(
        eq(syncLog.userId, userId),
        eq(syncLog.kind, 'detail'),
        eq(syncLog.status, 'running'),
      ),
    )
    .limit(1)

  if (active) {
    return { syncLogId: active.id, alreadyRunning: true }
  }

  const [{ id: syncLogId }] = await db
    .insert(syncLog)
    .values({
      userId,
      kind: 'detail',
      status: 'running',
    })
    .returning({ id: syncLog.id })

  // Fire-and-forget — the unawaited promise continues running on the
  // event loop after the response sends (srvx is long-lived Node).
  runDetailFetchWorker(userId, syncLogId).catch((err) => {
    console.error('[detail worker] failed:', err)
  })

  return { syncLogId, alreadyRunning: false }
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * The actual loop. Owns the sync_log row identified by syncLogId.
 * Exits when no more activities need detail (success) or on a non-429
 * error (failure). 429s pause and retry — they're not exit conditions.
 */
async function runDetailFetchWorker(
  userId: number,
  syncLogId: number,
): Promise<void> {
  const db = getDb()
  let callsUsed = 0
  let activitiesProcessed = 0

  try {
    // Loop until there's nothing left needing detail.
    // Each iteration: pick the oldest NULL-detail activity, fetch + store.
    // "Oldest first" lets the user see PR data populate from the start
    // of their training history forward, which feels more meaningful
    // than newest-first when watching the records tab fill in.
    for (;;) {
      const [next] = await db
        .select({ id: activities.id })
        .from(activities)
        .where(
          and(
            eq(activities.userId, userId),
            isNull(activities.detailSyncedAt),
          ),
        )
        .orderBy(asc(activities.startDate))
        .limit(1)

      if (!next) break

      const accessToken = await withFreshToken(userId)

      try {
        const result = await storeActivityDetail(
          accessToken,
          userId,
          next.id,
        )
        callsUsed += result.callsUsed
        activitiesProcessed++

        // Mark the activity done. detailSyncedAt is what the next loop
        // iteration's WHERE clause filters on — bumping it removes this
        // activity from the work queue.
        await db
          .update(activities)
          .set({ detailSyncedAt: new Date() })
          .where(eq(activities.id, next.id))

        // Update progress on the sync_log row periodically so a UI poll
        // can show "X activities processed, Y calls used."
        await db
          .update(syncLog)
          .set({ callsUsed })
          .where(eq(syncLog.id, syncLogId))

        // Live-updates fan-out: nudge open dashboards each time a new
        // activity's best_efforts + streams land. The Records tab is
        // the most visible benefactor — PRs progressively fill in as
        // older activities get processed. Per-activity is fine: the
        // worker is rate-limited (~1 activity per 18s during normal
        // operation, much slower under 429), so we never spam the bus.
        publish(userId, { type: 'activity-changed', reason: 'detail-worker' })
      } catch (err) {
        if (err instanceof StravaRateLimitedError) {
          const ms =
            err.retryAfterSeconds !== null
              ? err.retryAfterSeconds * 1000
              : DEFAULT_RETRY_AFTER_MS
          console.log(
            `[detail worker] rate limited at activity ${next.id} (${activitiesProcessed} done, ${callsUsed} calls). Sleeping ${Math.round(ms / 1000)}s…`,
          )
          // Surface the pause on the sync_log row so polling can render
          // a "waiting on rate limit" message if we add UI later.
          await db
            .update(syncLog)
            .set({ status: 'rate_limited' })
            .where(eq(syncLog.id, syncLogId))

          await sleep(ms)

          await db
            .update(syncLog)
            .set({ status: 'running' })
            .where(eq(syncLog.id, syncLogId))
          // Loop continues — the same activity will be picked up again
          // because detailSyncedAt is still NULL.
          continue
        }
        // Anything else: bail out and mark the sync errored.
        throw err
      }
    }

    await db
      .update(syncLog)
      .set({
        status: 'success',
        finishedAt: new Date(),
        callsUsed,
      })
      .where(eq(syncLog.id, syncLogId))

    console.log(
      `[detail worker] done. ${activitiesProcessed} activities, ${callsUsed} Strava calls.`,
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(syncLog)
      .set({
        status: 'error',
        finishedAt: new Date(),
        callsUsed,
        error: message,
      })
      .where(eq(syncLog.id, syncLogId))
    throw err
  }
}
