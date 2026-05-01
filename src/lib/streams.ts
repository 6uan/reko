/**
 * Stream-derived best-effort computation.
 *
 * Strava's `best_efforts` are sometimes missing for activities even when
 * the underlying GPS streams are present (slow paces, frequent pauses,
 * GPS quality, etc.). Given Strava's `time` and `distance` streams, we
 * can compute the same numbers ourselves with a sliding window.
 *
 * Convention matches Strava's: elapsed time, not moving time. If the
 * activity included a pause mid-5k, that pause counts toward the split.
 */
import type { BestEffortTimes } from './activities'

/** Canonical target distances (meters) we report splits for. */
export const SPLIT_DISTANCES: Array<{ key: keyof BestEffortTimes; meters: number }> = [
  { key: '1k', meters: 1000 },
  { key: '1 mile', meters: 1609.34 },
  { key: '5k', meters: 5000 },
  { key: '10k', meters: 10000 },
  { key: 'Half-Marathon', meters: 21097.5 },
  { key: 'Marathon', meters: 42195 },
]

/**
 * Find the fastest contiguous window of at least `target` meters across
 * the (distance, time) streams. Returns the elapsed seconds, or `null`
 * if the activity never accumulated `target` meters.
 *
 * Two-pointer sliding window: O(n). Distance is monotonically non-decreasing
 * (Strava's `distance` stream is cumulative), so we can advance both
 * pointers in lockstep.
 */
export function bestSplitSeconds(
  distance: number[],
  time: number[],
  target: number,
): number | null {
  const n = distance.length
  if (n < 2 || time.length !== n) return null
  if (distance[n - 1] - distance[0] < target) return null

  let i = 0
  let best = Infinity

  for (let j = 1; j < n; j++) {
    // Advance the left pointer as far as possible while still covering target.
    while (i + 1 < j && distance[j] - distance[i + 1] >= target) {
      i++
    }
    if (distance[j] - distance[i] >= target) {
      const elapsed = time[j] - time[i]
      if (elapsed < best) best = elapsed
    }
  }

  return best === Infinity ? null : best
}

/**
 * Compute best-effort splits for every applicable canonical distance.
 * Skips distances longer than the activity's total covered distance.
 */
export function computeBestEfforts(
  distance: number[],
  time: number[],
): BestEffortTimes {
  const result: BestEffortTimes = {}
  for (const { key, meters } of SPLIT_DISTANCES) {
    const seconds = bestSplitSeconds(distance, time, meters)
    if (seconds !== null) result[key] = seconds
  }
  return result
}
