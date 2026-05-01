/**
 * Records-tab data loader (SERVER ONLY).
 *
 * Reads from `best_efforts` (Strava's per-distance splits, populated by
 * the detail-fetch worker — Chunk 1.2.b) joined to `activities` so we can
 * surface the parent activity name + Strava ID alongside each effort.
 *
 * For each canonical distance we compute:
 *   - best / runnerUp / thirdBest (top-3 by elapsed_time)
 *   - trend (chronological list of running-best — every improvement is
 *     a point on the progression chart and the per-distance sparkline)
 *
 * Returned shape is plain JSON-serializable so the dashboard loader can
 * forward it through `createServerFn` to the client without additional
 * mapping. `null` means the user hasn't run that distance yet.
 *
 * Not a server fn itself — designed to be called from inside the
 * dashboard's `loadDashboardData` handler, which already authenticates.
 *
 * IMPORTANT: this module imports `pg` (via `getDb`). Do NOT import it
 * from any client component — that pulls Node-only modules into the
 * browser bundle. Client code should import from `./distances` instead
 * (constants + types only, no DB).
 */

import { asc, eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities, bestEfforts } from '@/db/schema'
import {
  DISTANCE_DEFS,
  type DistanceRecord,
  type RecordEffort,
  type RecordsData,
} from './distances'

export async function getRecordsData(userId: number): Promise<RecordsData> {
  const db = getDb()

  // Single query — best_efforts joined to activities for parent name +
  // ID. Ordered chronologically so `trend` (the running-best walk) just
  // iterates in order without re-sorting.
  const rows = await db
    .select({
      name: bestEfforts.name,
      elapsedTime: bestEfforts.elapsedTime,
      movingTime: bestEfforts.movingTime,
      startDateLocal: bestEfforts.startDateLocal,
      activityId: bestEfforts.activityId,
      activityName: activities.name,
    })
    .from(bestEfforts)
    .innerJoin(activities, eq(bestEfforts.activityId, activities.id))
    .where(eq(bestEfforts.userId, userId))
    .orderBy(asc(bestEfforts.startDateLocal))

  const distances: DistanceRecord[] = DISTANCE_DEFS.map((def) => {
    const efforts = rows.filter((r) => r.name === def.stravaName)
    if (efforts.length === 0) {
      return {
        key: def.key,
        label: def.label,
        meters: def.meters,
        best: null,
        runnerUp: null,
        thirdBest: null,
        trend: [],
      }
    }

    // Top-3 by elapsed_time (fastest first). The "previous best" the UI
    // shows in the hero card is just `runnerUp.elapsedTime` — by
    // construction that's the time the current PR most recently
    // improved from.
    const byTime = [...efforts].sort((a, b) => a.elapsedTime - b.elapsedTime)
    const toEffort = (r: (typeof efforts)[number]): RecordEffort => ({
      elapsedTime: r.elapsedTime,
      movingTime: r.movingTime,
      startDateLocal: r.startDateLocal,
      activityId: r.activityId,
      activityName: r.activityName,
    })

    // Running-min walk over chronological order. Emit a point only
    // when the time actually improves — flat efforts (slower attempts
    // after a PR) don't add noise to the chart.
    const trend: { date: string; time: number }[] = []
    let runningMin = Infinity
    for (const r of efforts) {
      if (r.elapsedTime < runningMin) {
        runningMin = r.elapsedTime
        trend.push({ date: r.startDateLocal, time: r.elapsedTime })
      }
    }

    return {
      key: def.key,
      label: def.label,
      meters: def.meters,
      best: toEffort(byTime[0]),
      runnerUp: byTime[1] ? toEffort(byTime[1]) : null,
      thirdBest: byTime[2] ? toEffort(byTime[2]) : null,
      trend,
    }
  })

  return { distances }
}
