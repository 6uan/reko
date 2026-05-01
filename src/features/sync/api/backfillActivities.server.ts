/**
 * Bulk-fetch every activity from Strava for a user and upsert into DB.
 *
 * Public API:
 *   enqueueBackfill(userId)
 *     → inserts a sync_log row synchronously (so polling can observe it
 *       immediately), then fires the worker fire-and-forget. Returns
 *       { syncLogId, alreadyRunning } so callers can react.
 *     → idempotent: if a sync is already 'running' for this user, no
 *       new row is created and `alreadyRunning: true` is returned.
 *
 * Why split insert + worker:
 *   The dashboard loader and the resync button both need the sync_log
 *   row to exist BEFORE they invalidate the route / remount the banner —
 *   otherwise the banner's first poll races and misses the new sync.
 *
 * Idempotent at the data level too — `ON CONFLICT (id) DO UPDATE` means
 * re-running just refreshes existing rows. Stores ALL activity types,
 * not just runs (filtering happens at read time).
 */

import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities, syncLog } from '@/db/schema'
import { publish } from '@/lib/eventBus'
import { fetchAthleteActivities } from '@/lib/strava'
import { RESYNC_COOLDOWN_MS } from '../constants'
import { mapStravaActivity } from './mapStravaActivity.server'
import { enqueueDetailFetch } from './runDetailFetchWorker.server'
import { withFreshToken } from './withFreshToken.server'

const PAGE_SIZE = 200 // Strava's max

export type EnqueueResult = {
  /** null when cooledDown short-circuited — no sync_log row was created. */
  syncLogId: number | null
  alreadyRunning: boolean
  /** True when refused because the previous sync finished < cooldown ago. */
  cooledDown: boolean
}

/**
 * Insert a sync_log row + start the worker. Returns as soon as the row
 * is committed; the worker continues in the background.
 */
export async function enqueueBackfill(
  userId: number,
): Promise<EnqueueResult> {
  const db = getDb()

  // Reuse an in-flight sync if one exists. Scoped to kind='backfill' so a
  // long-running detail fetch (which sits in status='running' for a while)
  // doesn't block the user from kicking off a fresh summary backfill.
  const [active] = await db
    .select({ id: syncLog.id })
    .from(syncLog)
    .where(
      and(
        eq(syncLog.userId, userId),
        eq(syncLog.kind, 'backfill'),
        eq(syncLog.status, 'running'),
      ),
    )
    .limit(1)

  if (active) {
    return { syncLogId: active.id, alreadyRunning: true, cooledDown: false }
  }

  // Cooldown guard: if the most recent FINISHED backfill is within the
  // cooldown window, refuse to fire a new one. Defense-in-depth — the
  // ResyncButton is visually disabled during this window, so this only
  // trips for direct API hits (devtools, scripts). Filtered to kind=
  // 'backfill' so a recently-finished detail fetch doesn't gate this.
  const [recent] = await db
    .select({ finishedAt: syncLog.finishedAt })
    .from(syncLog)
    .where(
      and(
        eq(syncLog.userId, userId),
        eq(syncLog.kind, 'backfill'),
        isNotNull(syncLog.finishedAt),
      ),
    )
    .orderBy(desc(syncLog.finishedAt))
    .limit(1)

  if (recent?.finishedAt) {
    const sinceMs = Date.now() - recent.finishedAt.getTime()
    if (sinceMs < RESYNC_COOLDOWN_MS) {
      return { syncLogId: null, alreadyRunning: false, cooledDown: true }
    }
  }

  const [{ id: syncLogId }] = await db
    .insert(syncLog)
    .values({
      userId,
      kind: 'backfill',
      status: 'running',
    })
    .returning({ id: syncLog.id })

  // Fire-and-forget — srvx is long-lived Node, the unawaited promise
  // continues running on the event loop after the response sends.
  runBackfillWorker(userId, syncLogId).catch((err) => {
    console.error('[backfill worker] failed:', err)
  })

  return { syncLogId, alreadyRunning: false, cooledDown: false }
}

/**
 * The actual page-by-page worker. Owns the sync_log row identified by
 * syncLogId and updates it as it progresses.
 */
async function runBackfillWorker(
  userId: number,
  syncLogId: number,
): Promise<void> {
  const db = getDb()
  let pagesFetched = 0

  try {
    const accessToken = await withFreshToken(userId)

    for (let page = 1; ; page++) {
      const batch = await fetchAthleteActivities(accessToken, {
        page,
        per_page: PAGE_SIZE,
      })
      pagesFetched++

      // Track API usage on the sync_log row as we go.
      await db
        .update(syncLog)
        .set({ callsUsed: pagesFetched })
        .where(eq(syncLog.id, syncLogId))

      if (batch.length === 0) break

      const rows = batch.map((a) => mapStravaActivity(userId, a))

      // Batch upsert. EXCLUDED is the proposed-row pseudo-table inside
      // ON CONFLICT — refers to each new row's value per upsert.
      await db
        .insert(activities)
        .values(rows)
        .onConflictDoUpdate({
          target: activities.id,
          set: {
            name: sql`excluded.name`,
            type: sql`excluded.type`,
            sportType: sql`excluded.sport_type`,
            distance: sql`excluded.distance`,
            movingTime: sql`excluded.moving_time`,
            elapsedTime: sql`excluded.elapsed_time`,
            totalElevationGain: sql`excluded.total_elevation_gain`,
            startDate: sql`excluded.start_date`,
            startDateLocal: sql`excluded.start_date_local`,
            averageSpeed: sql`excluded.average_speed`,
            maxSpeed: sql`excluded.max_speed`,
            averageHeartrate: sql`excluded.average_heartrate`,
            maxHeartrate: sql`excluded.max_heartrate`,
            averageCadence: sql`excluded.average_cadence`,
            prCount: sql`excluded.pr_count`,
            hasHeartrate: sql`excluded.has_heartrate`,
            raw: sql`excluded.raw`,
            syncedAt: sql`now()`,
          },
        })

      // Strava returns a full page when more remain; short page = end.
      if (batch.length < PAGE_SIZE) break
    }

    await db
      .update(syncLog)
      .set({
        status: 'success',
        finishedAt: new Date(),
        callsUsed: pagesFetched,
      })
      .where(eq(syncLog.id, syncLogId))

    // Live-updates fan-out: signal any open dashboard tabs that the
    // summary cache is fully loaded. Mostly redundant with SyncBanner's
    // own router.invalidate() (it polls until it sees status='success'
    // and invalidates then), but covers the multi-tab case — only one
    // tab runs the banner's poller, every tab is subscribed to the bus.
    publish(userId, { type: 'activity-changed', reason: 'backfill' })

    // Kick off the detail-fetch worker now that the summary cache is
    // current. Fire-and-forget — this can take a long time (rate limits)
    // and the user should already see their dashboard. The SyncBanner
    // filters on kind='backfill' so this background work stays invisible.
    enqueueDetailFetch(userId).catch((err) => {
      console.error('[backfill worker] failed to enqueue detail fetch:', err)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(syncLog)
      .set({
        status: 'error',
        finishedAt: new Date(),
        error: message,
        callsUsed: pagesFetched,
      })
      .where(eq(syncLog.id, syncLogId))
    throw err
  }
}
