/**
 * Shared activity types and helpers.
 *
 * `DashboardRun` is the client-side shape every tab component consumes.
 * Defined here (not in a route file) so features can import it without
 * creating a feature -> route dependency. `activityKind`, `KM_PER_MI`,
 * and `toDisplayDistance` lived duplicated across 5-7 files — single
 * source of truth now.
 */

import { formatDistanceKm } from './strava'

// ── Types ──────────────────────────────────────────────────────────

export type DashboardRun = {
  id: number
  name: string
  /** Strava's legacy sport field — always populated. e.g. 'Run', 'Walk', 'Ride'. */
  type: string
  /** Strava's modern, more granular sport_type — nullable for older activities.
   *  e.g. 'Run', 'TrailRun', 'VirtualRun', 'Walk'. */
  sportType: string | null
  date: string
  distanceMeters: number
  movingTime: number
  avgSpeed: number
  avgHr: number | null
  maxHr: number | null
  cadence: number | null
  elevation: number
  prCount: number
}

/** Distance unit preference. */
export type Unit = 'km' | 'mi'

// ── Constants ──────────────────────────────────────────────────────

export const KM_PER_MI = 1609.34

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Classify an activity for UI grouping. Strava's `type` is legacy and
 * coarse ('Run', 'Walk'), `sport_type` is granular ('Run', 'TrailRun',
 * 'VirtualRun', 'Walk', 'NordicWalk'). Treat any *Run* sport_type as a
 * run and any *Walk* sport_type as a walk; fall back to `type` when
 * sport_type is null (older activities pre-dating the sport_type field).
 */
export function activityKind(
  a: Pick<DashboardRun, 'type' | 'sportType'>,
): 'run' | 'walk' | 'other' {
  const sport = a.sportType ?? a.type
  if (sport === 'Run' || sport === 'TrailRun' || sport === 'VirtualRun')
    return 'run'
  if (sport === 'Walk' || sport === 'NordicWalk') return 'walk'
  return 'other'
}

/**
 * Format a distance in meters to a display string in the given unit.
 * km → delegates to `formatDistanceKm`, mi → simple division + 2 decimals.
 */
export function toDisplayDistance(meters: number, unit: Unit): string {
  if (unit === 'mi') return (meters / KM_PER_MI).toFixed(2)
  return formatDistanceKm(meters)
}
