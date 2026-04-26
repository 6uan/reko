/**
 * Bulk-fetch every activity from Strava for a user and upsert into DB.
 *
 * Idempotent — `ON CONFLICT (id) DO UPDATE` means re-running just
 * refreshes existing rows. Safe to call repeatedly.
 *
 * Writes a `sync_log` row to make progress observable (used by the
 * polling banner UX in 1.1.c).
 *
 * Stores ALL activity types, not just runs. Filtering happens at read
 * time so we keep options open for future cross-training tabs.
 */

import { eq, sql } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { activities, syncLog } from '../../db/schema'
import { fetchAthleteActivities } from '../../lib/strava'
import { mapStravaActivity } from './mapStravaActivity'
import { withFreshToken } from './withFreshToken'

const PAGE_SIZE = 200 // Strava's max

export type BackfillResult = {
  syncLogId: number
  pagesFetched: number
  activitiesUpserted: number
}

export async function backfillActivities(
  userId: number,
): Promise<BackfillResult> {
  const db = getDb()

  // Open a sync_log row so the UX can observe progress
  const [{ id: syncLogId }] = await db
    .insert(syncLog)
    .values({
      userId,
      kind: 'backfill',
      status: 'running',
    })
    .returning({ id: syncLog.id })

  let pagesFetched = 0
  let activitiesUpserted = 0

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

      activitiesUpserted += batch.length

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

    return { syncLogId, pagesFetched, activitiesUpserted }
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
