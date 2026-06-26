/**
 * Shared SQL predicates for classifying activities by sport.
 *
 * Strava's modern `sport_type` is granular (Run / TrailRun / VirtualRun,
 * Walk / NordicWalk); the legacy `type` is coarse ('Run', 'Walk') and is the
 * only signal for older activities where `sport_type` is null. These mirror
 * `activityKind()` in lib/activities.ts so SQL-level filters and client-side
 * classification can never disagree — previously the SQL checked only
 * `type='Run' OR sport_type='Run'`, silently dropping trail and treadmill runs.
 */

import { sql, type SQL } from 'drizzle-orm'
import { activities } from './schema'

/** Activities that count as runs (Run / TrailRun / VirtualRun). */
export function isRunActivity(): SQL {
  return sql`coalesce(${activities.sportType}, ${activities.type}) in ('Run', 'TrailRun', 'VirtualRun')`
}

/** Activities that count as walks (Walk / NordicWalk). */
export function isWalkActivity(): SQL {
  return sql`coalesce(${activities.sportType}, ${activities.type}) in ('Walk', 'NordicWalk')`
}
