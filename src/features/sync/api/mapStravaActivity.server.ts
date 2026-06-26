/**
 * Pure mapper: Strava list-activity payload → DB row.
 *
 * Notes on time columns:
 *   - `start_date` is ISO UTC. We store as `timestamp with time zone`.
 *   - `start_date_local` is ISO with a misleading "Z" suffix — Strava
 *     sends the wall-clock time as if it were UTC. We store it in
 *     `timestamp without time zone`, which preserves the wall-clock.
 *
 * Cadence stays as Strava-native RPM (one foot). UI doubles to SPM.
 *
 * The full Strava payload is mirrored into `raw` jsonb as forward-compat
 * insurance — new Strava fields surface in the DB without a migration.
 */

import type { StravaActivity } from '@/lib/strava'
import type { NewActivity } from '@/db/schema'

export function mapStravaActivity(
  userId: number,
  activity: StravaActivity,
): NewActivity {
  return {
    id: activity.id,
    userId,
    name: activity.name,
    type: activity.type,
    sportType: activity.sport_type ?? null,
    distance: activity.distance,
    movingTime: activity.moving_time,
    elapsedTime: activity.elapsed_time,
    totalElevationGain: activity.total_elevation_gain ?? 0,
    startDate: new Date(activity.start_date),
    // String pass-through — the column is `timestamp without time zone` and
    // we want to preserve Strava's wall-clock without TZ round-tripping.
    startDateLocal: activity.start_date_local,
    averageSpeed: activity.average_speed ?? null,
    maxSpeed: activity.max_speed ?? null,
    averageHeartrate: activity.average_heartrate != null ? Math.round(activity.average_heartrate) : null,
    maxHeartrate: activity.max_heartrate != null ? Math.round(activity.max_heartrate) : null,
    averageCadence: activity.average_cadence ?? null,
    prCount: activity.pr_count ?? 0,
    hasHeartrate: activity.has_heartrate ?? false,
    ...richActivityFields(activity),
    raw: activity as unknown,
    syncedAt: new Date(),
  }
}

/**
 * Extract the nullable "rich" activity columns from a Strava payload. Shared
 * by mapStravaActivity (summary list + webhook detail), storeActivityDetail
 * (full detail), and the raw-backfill. Fields the summary endpoint omits
 * (calories, elev_high/low, average_temp) arrive null until the detail
 * payload is seen, then get filled by storeActivityDetail.
 */
export function richActivityFields(a: StravaActivity) {
  return {
    workoutType: a.workout_type ?? null,
    gearId: a.gear_id ?? null,
    manual: a.manual ?? false,
    calories: a.calories ?? null,
    sufferScore: a.suffer_score ?? null,
    averageWatts: a.average_watts ?? null,
    maxWatts: a.max_watts ?? null,
    deviceName: a.device_name ?? null,
    elevHigh: a.elev_high ?? null,
    elevLow: a.elev_low ?? null,
    averageTemp: a.average_temp ?? null,
  }
}
