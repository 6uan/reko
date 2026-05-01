/**
 * Client-safe constants + types for the Records feature.
 *
 * Lives in its own file (rather than alongside the DB query in
 * `getRecordsData.ts`) so the React tab can import `DISTANCE_DEFS` and
 * the data-shape types without dragging the Drizzle / pg client into
 * the browser bundle. Importing the query module from a client
 * component pulls in `pg`, which crashes the browser at runtime
 * ("events has been externalized" / "Buffer is not defined").
 */

// ── Canonical distances ───────────────────────────────────────────────
//
// Strava precomputes best efforts at exactly six distances. The
// `stravaName` literal must match the `name` field on the best_effort
// payload byte-for-byte (case + hyphenation) — see the Strava API
// reference: 1k, 1 mile, 5K, 10K, Half-Marathon, Marathon.

// `stravaName` MUST match Strava's `best_efforts[i].name` byte-for-byte.
// Empirically Strava sends `1K` (capital K) — same convention as `5K` /
// `10K`. The earlier lowercase `1k` was a guess based on outdated docs
// and silently dropped every 1K effort from the records UI.
export const DISTANCE_DEFS = [
  { key: '1k', stravaName: '1K', label: '1 km', meters: 1000 },
  { key: '1mi', stravaName: '1 mile', label: '1 mile', meters: 1609.34 },
  { key: '5k', stravaName: '5K', label: '5K', meters: 5000 },
  { key: '10k', stravaName: '10K', label: '10K', meters: 10000 },
  {
    key: 'half',
    stravaName: 'Half-Marathon',
    label: 'Half marathon',
    meters: 21097.5,
  },
  { key: 'mar', stravaName: 'Marathon', label: 'Marathon', meters: 42195 },
] as const

export type DistanceKey = (typeof DISTANCE_DEFS)[number]['key']

// ── UI-facing types ───────────────────────────────────────────────────

/** A single best-effort row, flattened for the UI. */
export type RecordEffort = {
  elapsedTime: number // seconds
  movingTime: number // seconds
  /** "YYYY-MM-DD HH:MM:SS" wall-clock — same convention as activities. */
  startDateLocal: string
  activityId: number
  activityName: string
}

/** Per-distance summary the UI consumes. */
export type DistanceRecord = {
  key: DistanceKey
  label: string
  meters: number
  /** Top by elapsed_time. null when no efforts at this distance. */
  best: RecordEffort | null
  runnerUp: RecordEffort | null
  thirdBest: RecordEffort | null
  /**
   * Running-best over time (chronological, monotonically improving).
   * One point per PR-setting effort. Used by the per-distance sparkline
   * and the multi-distance progression chart.
   */
  trend: { date: string; time: number }[]
}

export type RecordsData = {
  distances: DistanceRecord[]
}
