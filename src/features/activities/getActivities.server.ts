/**
 * Activities data loader (SERVER ONLY).
 *
 * Reads all runs + walks from the DB cache and maps them to the
 * client-safe `DashboardRun` shape. Strava splits `type` (legacy,
 * coarse) from `sport_type` (modern, granular) — we match either for
 * both Run and Walk to catch TrailRun/VirtualRun/NordicWalk variants.
 * Other sport types (Ride, Hike, Workout, …) are excluded — Reko is a
 * running dashboard with walks as a secondary view, not a general
 * activity tracker.
 *
 * Not a server fn itself — designed to be called from inside the
 * dashboard's `loadDashboardData` handler, which already authenticates.
 *
 * IMPORTANT: this module imports `pg` (via `getDb`). Do NOT import it
 * from any client component — that pulls Node-only modules into the
 * browser bundle.
 */

import { and, desc, eq, or } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { activities } from '../../db/schema'
import type { DashboardRun } from '../../lib/activities'

export async function getActivities(userId: number): Promise<DashboardRun[]> {
  const db = getDb()

  const dbRuns = await db
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
    .orderBy(desc(activities.startDate))

  return dbRuns.map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    sportType: a.sportType,
    // startDateLocal is "YYYY-MM-DD HH:MM:SS" (wall-clock string).
    // Convert to ISO-style "YYYY-MM-DDTHH:MM:SSZ" so consumers' new Date()
    // parses consistently across browsers.
    date: a.startDateLocal.replace(' ', 'T') + 'Z',
    distanceMeters: a.distance,
    movingTime: a.movingTime,
    avgSpeed: a.averageSpeed ?? 0,
    avgHr: a.averageHeartrate,
    maxHr: a.maxHeartrate,
    cadence: a.averageCadence ? Math.round(a.averageCadence * 2) : null,
    elevation: a.totalElevationGain,
    prCount: a.prCount,
  }))
}
