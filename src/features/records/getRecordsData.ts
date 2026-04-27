/**
 * Records-tab data loader.
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
 */

import { asc, eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { activities, bestEfforts } from '../../db/schema'

// ── Canonical distances ───────────────────────────────────────────────
//
// Strava precomputes best efforts at exactly six distances. The
// `stravaName` literal must match the `name` field on the best_effort
// payload byte-for-byte (case + hyphenation) — see the Strava API
// reference: 1k, 1 mile, 5K, 10K, Half-Marathon, Marathon.

export const DISTANCE_DEFS = [
  { key: '1k', stravaName: '1k', label: '1 km', meters: 1000 },
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

// ── Types ─────────────────────────────────────────────────────────────

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

// ── Loader ────────────────────────────────────────────────────────────

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
