import { describe, it, expect } from 'vitest'
import {
  HR_ZONES,
  ZONE_WINDOWS,
  fallbackWindowsFor,
  formatWindow,
  rangeLabel,
  zoneFor,
  bestSustainedPaceInZone,
  computeHrZoneEfforts,
} from '@/lib/heartRate'

describe('fallbackWindowsFor', () => {
  it('clips to each zone canonical max, descending', () => {
    // Z1/Z2 cap at 1200 → all six windows.
    expect(fallbackWindowsFor('Z1 Recovery')).toEqual([
      1200, 600, 300, 120, 60, 30,
    ])
    expect(fallbackWindowsFor('Z2 Aerobic')).toEqual([1200, 600, 300, 120, 60, 30])
    // Z3 caps at 600.
    expect(fallbackWindowsFor('Z3 Tempo')).toEqual([600, 300, 120, 60, 30])
    // Z4 caps at 300.
    expect(fallbackWindowsFor('Z4 Threshold')).toEqual([300, 120, 60, 30])
    // Z5 caps at 60.
    expect(fallbackWindowsFor('Z5 VO₂max')).toEqual([60, 30])
  })

  it('only returns windows <= the zone canonical window', () => {
    for (const zone of HR_ZONES) {
      const cap = ZONE_WINDOWS[zone.name]
      expect(fallbackWindowsFor(zone.name).every((w) => w <= cap)).toBe(true)
    }
  })
})

describe('formatWindow', () => {
  it('renders minutes at/above 60s', () => {
    expect(formatWindow(60)).toBe('1m')
    expect(formatWindow(120)).toBe('2m')
    expect(formatWindow(300)).toBe('5m')
    expect(formatWindow(600)).toBe('10m')
    expect(formatWindow(1200)).toBe('20m')
  })

  it('renders seconds below 60s', () => {
    expect(formatWindow(30)).toBe('30s')
    expect(formatWindow(59)).toBe('59s')
  })
})

describe('rangeLabel', () => {
  it('renders a bounded zone range', () => {
    expect(rangeLabel(HR_ZONES[0])).toBe('0–124 bpm') // Z1
    expect(rangeLabel(HR_ZONES[3])).toBe('162–181 bpm') // Z4
  })

  it('renders the open-ended top zone with a plus', () => {
    expect(rangeLabel(HR_ZONES[4])).toBe('181+ bpm') // Z5, max Infinity
  })
})

describe('zoneFor', () => {
  it('maps representative heart rates to the right zone', () => {
    expect(zoneFor(100).name).toBe('Z1 Recovery')
    expect(zoneFor(130).name).toBe('Z2 Aerobic')
    expect(zoneFor(150).name).toBe('Z3 Tempo')
    expect(zoneFor(170).name).toBe('Z4 Threshold')
    expect(zoneFor(190).name).toBe('Z5 VO₂max')
  })

  it('is left-inclusive / right-exclusive at boundaries', () => {
    // 124 is the Z2 min and the Z1 max → belongs to Z2 (min<=hr<max).
    expect(zoneFor(124).name).toBe('Z2 Aerobic')
    expect(zoneFor(123).name).toBe('Z1 Recovery')
    expect(zoneFor(181).name).toBe('Z5 VO₂max') // Z4 max → Z5
    expect(zoneFor(180).name).toBe('Z4 Threshold')
  })

  it('falls back to Z5 for out-of-range (negative) input', () => {
    // No zone matches hr < 0 (Z1 min is 0), so it falls through to HR_ZONES[4].
    expect(zoneFor(-10).name).toBe('Z5 VO₂max')
  })
})

describe('bestSustainedPaceInZone', () => {
  it('returns null for too-few samples or mismatched lengths', () => {
    expect(bestSustainedPaceInZone([0], [0], [130], 124, 143, 60)).toBeNull()
    expect(
      bestSustainedPaceInZone([0, 1], [0, 1], [130], 124, 143, 60),
    ).toBeNull() // hr shorter than distance/time
    expect(
      bestSustainedPaceInZone([0, 1, 2], [0, 1], [130, 130], 124, 143, 60),
    ).toBeNull() // time shorter
  })

  it('returns null when no window stays in zone long enough', () => {
    // All HR in Z2 but total span (10s) < 60s window.
    const time = [0, 5, 10]
    const dist = [0, 25, 50]
    const hr = [130, 130, 130]
    expect(bestSustainedPaceInZone(dist, time, hr, 124, 143, 60)).toBeNull()
  })

  it('computes pace over a single in-zone segment (constant speed)', () => {
    // 3 m/s for 120s, HR steady in Z2. 60s window → 1000/3 sec/km.
    const n = 13 // 0..120s in 10s steps
    const time = Array.from({ length: n }, (_, i) => i * 10)
    const dist = Array.from({ length: n }, (_, i) => i * 30) // 3 m/s
    const hr = Array.from({ length: n }, () => 130) // Z2
    const pace = bestSustainedPaceInZone(dist, time, hr, 124, 143, 60)
    expect(pace).not.toBeNull()
    expect(pace as number).toBeCloseTo(1000 / 3, 6)
  })

  it('finds the FASTEST 60s window within a segment', () => {
    // First half slow (2 m/s), second half fast (5 m/s), all in Z2.
    // 0..50s @ 2 m/s, 50..110s @ 5 m/s, 10s steps.
    const time = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110]
    const dist = [0, 20, 40, 60, 80, 100, 150, 200, 250, 300, 350, 400]
    const hr = time.map(() => 130) // Z2 throughout
    const pace = bestSustainedPaceInZone(dist, time, hr, 124, 143, 60)
    // Best 60s window is the fast tail: 5 m/s → 200 sec/km.
    expect(pace as number).toBeCloseTo(200, 6)
  })

  it('ignores samples outside the zone (breaks segments)', () => {
    // A spike out of zone splits the run into two too-short segments.
    const time = [0, 20, 40, 60, 80, 100, 120]
    const dist = [0, 60, 120, 180, 240, 300, 360]
    // index 3 jumps to Z4 → segments are [0..2] (40s) and [4..6] (40s),
    // both < 60s, so no qualifying window.
    const hr = [130, 130, 130, 170, 130, 130, 130]
    expect(bestSustainedPaceInZone(dist, time, hr, 124, 143, 60)).toBeNull()
  })

  it('returns null when distance does not advance (no positive split)', () => {
    // In zone and long enough, but distance is flat → dd never > 0.
    const time = [0, 30, 60, 90]
    const dist = [100, 100, 100, 100]
    const hr = [130, 130, 130, 130]
    expect(bestSustainedPaceInZone(dist, time, hr, 124, 143, 60)).toBeNull()
  })
})

describe('computeHrZoneEfforts', () => {
  it('returns an empty object when no zone has a qualifying window', () => {
    // Too short for any window (shortest window is 30s, span is 20s).
    const time = [0, 10, 20]
    const dist = [0, 30, 60]
    const hr = [130, 130, 130]
    expect(computeHrZoneEfforts(dist, time, hr)).toEqual({})
  })

  it('populates only the zone the data lives in, across fallback windows', () => {
    // 4 minutes (240s) steady in Z2 at 3 m/s. Z2 caps at 1200 but only
    // windows <= the 240s span (120, 60, 30) can qualify.
    const n = 25 // 0..240s in 10s steps
    const time = Array.from({ length: n }, (_, i) => i * 10)
    const dist = Array.from({ length: n }, (_, i) => i * 30)
    const hr = Array.from({ length: n }, () => 130) // Z2
    const out = computeHrZoneEfforts(dist, time, hr)

    expect(Object.keys(out)).toEqual(['Z2 Aerobic'])
    const z2 = out['Z2 Aerobic']!
    // Only windows that fit a 240s span are present.
    expect(Object.keys(z2).map(Number).sort((a, b) => a - b)).toEqual([
      30, 60, 120,
    ])
    // Constant speed → every window's best pace is the same 1000/3.
    for (const w of [30, 60, 120]) {
      expect(z2[w]).toBeCloseTo(1000 / 3, 6)
    }
    // Other zones absent.
    expect(out['Z1 Recovery']).toBeUndefined()
    expect(out['Z4 Threshold']).toBeUndefined()
  })
})
