/**
 * Activities data loader (SERVER ONLY).
 *
 * Reads all runs + walks from the DB cache and maps them to the
 * client-safe `Activity` shape, including per-activity best effort
 * split times (1k, 1 mile, 5k, 10k, Half-Marathon, Marathon).
 *
 * Not a server fn itself — designed to be called from inside the
 * dashboard's `loadDashboardData` handler, which already authenticates.
 */

import { and, desc, eq, inArray, or } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { activities, bestEfforts } from '../../db/schema'
import type { BestEffortTimes, Activity } from '../../lib/activities'

/**
 * Strava stores effort names with inconsistent casing — e.g. "1K" / "5K"
 * (uppercase) vs "1 mile" (lowercase). Query both variants to be safe,
 * then normalize to our canonical BestEffortTimes keys in JS.
 */
const EFFORT_NAMES_QUERY = [
  '1k', '1K', '1 mile', '5k', '5K', '10k', '10K',
  'Half-Marathon', 'half-marathon', 'Marathon', 'marathon',
]

/** Map any Strava name variant → our canonical BestEffortTimes key. */
const CANONICAL_NAME: Record<string, keyof BestEffortTimes> = {
  '1k': '1k', '1K': '1k',
  '1 mile': '1 mile',
  '5k': '5k', '5K': '5k',
  '10k': '10k', '10K': '10k',
  'Half-Marathon': 'Half-Marathon', 'half-marathon': 'Half-Marathon',
  'Marathon': 'Marathon', 'marathon': 'Marathon',
}

export async function getActivities(userId: number): Promise<Activity[]> {
  const db = getDb()

  // Fetch activities and best efforts in parallel.
  const [dbRuns, dbEfforts] = await Promise.all([
    db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          or(
            eq(activities.type, 'Run'),
            eq(activities.sportType, 'Run'),
            eq(activities.type, 'Walk'),
            eq(activities.sportType, 'Walk'),
          ),
        ),
      )
      .orderBy(desc(activities.startDate)),

    // Fetch best efforts for all of this user's activities at once.
    // Filtered to only the distance names we care about.
    db
      .select({
        activityId: bestEfforts.activityId,
        name: bestEfforts.name,
        elapsedTime: bestEfforts.elapsedTime,
      })
      .from(bestEfforts)
      .where(
        and(
          eq(bestEfforts.userId, userId),
          inArray(bestEfforts.name, EFFORT_NAMES_QUERY),
        ),
      ),
  ])

  // Group best efforts by activity ID. When an activity has multiple
  // efforts at the same distance (e.g. a long run might have several
  // 1k splits), we take the fastest (minimum elapsed time).
  const effortsByActivity = new Map<number, BestEffortTimes>()
  for (const e of dbEfforts) {
    const key = CANONICAL_NAME[e.name]
    if (!key) continue // unknown name variant — skip

    let map = effortsByActivity.get(e.activityId)
    if (!map) {
      map = {}
      effortsByActivity.set(e.activityId, map)
    }
    const existing = map[key]
    if (existing === undefined || e.elapsedTime < existing) {
      map[key] = e.elapsedTime
    }
  }

  return dbRuns.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    sportType: a.sportType,
    date: a.startDateLocal.replace(' ', 'T') + 'Z',
    distanceMeters: a.distance,
    movingTime: a.movingTime,
    avgSpeed: a.averageSpeed ?? 0,
    avgHr: a.averageHeartrate,
    maxHr: a.maxHeartrate,
    cadence: a.averageCadence ? Math.round(a.averageCadence * 2) : null,
    elevation: a.totalElevationGain,
    prCount: a.prCount,
    bestEfforts: effortsByActivity.get(a.id) ?? {},
  }))
}
