/**
 * Shared activity types and helpers.
 *
 * `Activity` is the client-side shape every tab component consumes.
 * Defined here (not in a route file) so features can import it without
 * creating a feature -> route dependency. `activityKind`, `KM_PER_MI`,
 * and `toDisplayDistance` lived duplicated across 5-7 files — single
 * source of truth now.
 */

import { formatDistanceKm, speedToPaceSeconds } from './strava'
import type { HrZoneEfforts } from './heartRate'

// ── Types ──────────────────────────────────────────────────────────

/** Per-distance split times (elapsed seconds) from Strava's best_efforts. */
export type BestEffortTimes = {
  '1k'?: number
  '1 mile'?: number
  '5k'?: number
  '10k'?: number
  'Half-Marathon'?: number
  'Marathon'?: number
}

export type Activity = {
  id: number
  name: string
  type: string /** Strava's legacy sport field — always populated. e.g. 'Run', 'Walk', 'Ride'. */
  sportType: string | null /** Strava's modern, more granular sport_type — nullable for older activities. *  e.g. 'Run', 'TrailRun', 'VirtualRun', 'Walk'. */
  date: string
  distanceMeters: number
  movingTime: number
  avgSpeed: number
  avgHr: number | null
  maxHr: number | null
  cadence: number | null
  elevation: number
  prCount: number
  /** Best split times for standard distances, as reported by Strava's
   * best_efforts payload. Empty when Strava didn't compute splits. */
  bestEfforts: BestEffortTimes
  /** Best split times computed from our own sliding-window over the
   * activity's distance/time streams. Always populated when streams
   * are available, regardless of whether Strava also computed splits. */
  derivedBestEfforts: BestEffortTimes
  /** Per-zone fastest sustained pace (seconds per km) for this activity,
   * computed from streams. Empty when streams are missing or no zone
   * had a long-enough sustained window. */
  hrZoneEfforts: HrZoneEfforts
}

/**
 * Pick the displayed split value: prefer Strava's number when it exists,
 * otherwise fall back to our derived computation.
 */
export function effectiveBestEffort(
  activity: Pick<Activity, 'bestEfforts' | 'derivedBestEfforts'>,
  key: keyof BestEffortTimes,
): number | undefined {
  return activity.bestEfforts[key] ?? activity.derivedBestEfforts[key]
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
  a: Pick<Activity, 'type' | 'sportType'>,
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

/**
 * Convert a speed (m/s) to pace (seconds per unit distance).
 * Used by every analytics tab for chart/KPI calculations.
 */
export function paceForUnit(speedMs: number, unit: Unit): number {
  if (speedMs <= 0) return 0
  if (unit === 'mi') return KM_PER_MI / speedMs
  return speedToPaceSeconds(speedMs)
}

/** Average of a number array, returning 0 for empty arrays. */
export function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

// ── Unit labels ────────────────────────────────────────────────────

/** Display label for a distance value — "km" or "mi". */
export function distanceUnit(unit: Unit): string {
  return unit === 'mi' ? 'mi' : 'km'
}

/** Display label for a pace value — "/km" or "/mi". */
export function paceUnit(unit: Unit): string {
  return unit === 'mi' ? '/mi' : '/km'
}
