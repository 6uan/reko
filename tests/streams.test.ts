import { describe, it, expect } from 'vitest'
import {
  SPLIT_DISTANCES,
  bestSplitSeconds,
  computeBestEfforts,
} from '@/lib/streams'

describe('bestSplitSeconds', () => {
  it('returns null for too-few samples or mismatched lengths', () => {
    expect(bestSplitSeconds([0], [0], 1000)).toBeNull()
    expect(bestSplitSeconds([], [], 1000)).toBeNull()
    expect(bestSplitSeconds([0, 1000, 2000], [0, 300], 1000)).toBeNull()
  })

  it('returns null when the activity never covers the target', () => {
    // Only 500m total, asking for 1000m.
    const dist = [0, 250, 500]
    const time = [0, 75, 150]
    expect(bestSplitSeconds(dist, time, 1000)).toBeNull()
  })

  it('computes the split for a constant-pace run', () => {
    // 2000m at 4 min/km (240s/km) in 100m steps → 1000m = 240s.
    const dist = Array.from({ length: 21 }, (_, i) => i * 100)
    const time = Array.from({ length: 21 }, (_, i) => i * 24) // 24s per 100m
    expect(bestSplitSeconds(dist, time, 1000)).toBeCloseTo(240, 6)
  })

  it('finds the FASTEST 1k window, not the first', () => {
    // First km slow (300s), second km fast (180s).
    // Cumulative distance every 500m, time chosen for the per-km splits.
    const dist = [0, 500, 1000, 1500, 2000]
    const time = [0, 150, 300, 390, 480] // km1: 0->300 (300s), km2: 300->480 (180s)
    // Fastest contiguous 1000m window:
    //  - [0,1000] = 300s
    //  - [500,1500] = 240s
    //  - [1000,2000] = 180s  ← fastest
    expect(bestSplitSeconds(dist, time, 1000)).toBe(180)
  })

  it('counts paused (flat-distance) time toward the split (elapsed, not moving)', () => {
    // 1000m total but with a 100s pause where distance does not advance.
    // 0->500m in 100s, pause 100s, 500->1000m in 100s. Elapsed = 300s.
    const dist = [0, 500, 500, 1000]
    const time = [0, 100, 200, 300]
    expect(bestSplitSeconds(dist, time, 1000)).toBe(300)
  })

  it('handles a window that exactly meets the target distance', () => {
    // Exactly 1000m total → the whole run is the only qualifying window.
    const dist = [0, 1000]
    const time = [0, 250]
    expect(bestSplitSeconds(dist, time, 1000)).toBe(250)
  })
})

describe('computeBestEfforts', () => {
  it('returns an empty object for an activity shorter than every split', () => {
    // 800m run — under the shortest canonical split (1k).
    const dist = [0, 400, 800]
    const time = [0, 120, 240]
    expect(computeBestEfforts(dist, time)).toEqual({})
  })

  it('reports only splits the activity is long enough for', () => {
    // ~6km steady run at 5 min/km (300s/km). Should yield 1k, 1 mile, 5k
    // but not 10k / Half / Marathon.
    const km = 6
    const stepsPerKm = 10 // 100m steps
    const n = km * stepsPerKm + 1
    const dist = Array.from({ length: n }, (_, i) => i * 100)
    const time = Array.from({ length: n }, (_, i) => i * 30) // 30s / 100m = 300s/km
    const out = computeBestEfforts(dist, time)

    expect(out['1k']).toBeCloseTo(300, 6)
    // 1 mile = 1609.34m, but samples are 100m apart, so the window snaps to
    // the first bucket boundary >= a mile (1700m) = 17 steps * 30s = 510s.
    expect(out['1 mile']).toBe(510)
    expect(out['5k']).toBeCloseTo(1500, 6)
    // Beyond the activity length → omitted entirely.
    expect(out['10k']).toBeUndefined()
    expect(out['Half-Marathon']).toBeUndefined()
    expect(out['Marathon']).toBeUndefined()
  })

  it('only ever uses the canonical split keys', () => {
    const dist = Array.from({ length: 101 }, (_, i) => i * 100) // 10km
    const time = Array.from({ length: 101 }, (_, i) => i * 30)
    const out = computeBestEfforts(dist, time)
    const allowed = new Set<string>(SPLIT_DISTANCES.map((s) => s.key))
    expect(Object.keys(out).every((k) => allowed.has(k))).toBe(true)
    expect(out['10k']).toBeCloseTo(3000, 6)
  })
})
