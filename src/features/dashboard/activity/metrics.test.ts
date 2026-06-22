import { describe, it, expect } from 'vitest'
import {
  buildSeries,
  timeInZones,
  gradeAdjustedPace,
  gradeFactor,
  aerobicDecoupling,
} from './metrics'

describe('gradeFactor (Minetti)', () => {
  it('is 1 on the flat', () => {
    expect(gradeFactor(0)).toBeCloseTo(1, 10)
  })

  it('is >1 uphill and <1 downhill', () => {
    expect(gradeFactor(10)).toBeGreaterThan(1)
    expect(gradeFactor(-10)).toBeLessThan(1)
  })

  it('clamps extreme grades to ±35%', () => {
    expect(gradeFactor(50)).toBe(gradeFactor(35))
    expect(gradeFactor(-50)).toBe(gradeFactor(-35))
  })
})

describe('gradeAdjustedPace', () => {
  // 100 samples, constant 3 m/s (30 m per 10 s).
  const n = 100
  const time = Array.from({ length: n }, (_, i) => i * 10)
  const distance = Array.from({ length: n }, (_, i) => i * 30)

  it('returns nulls with too few samples', () => {
    expect(gradeAdjustedPace([0], [0], [])).toEqual({
      rawPaceSecPerKm: null,
      gapPaceSecPerKm: null,
    })
  })

  it('GAP ≈ raw pace on a flat run', () => {
    const grade = Array.from({ length: n }, () => 0)
    const { rawPaceSecPerKm, gapPaceSecPerKm } = gradeAdjustedPace(
      distance,
      time,
      grade,
    )
    // 3 m/s → 1000/3 ≈ 333.33 sec/km
    expect(rawPaceSecPerKm).toBeCloseTo(1000 / 3, 6)
    expect(gapPaceSecPerKm).toBeCloseTo(rawPaceSecPerKm as number, 6)
  })

  it('GAP is faster than raw on an uphill run', () => {
    const grade = Array.from({ length: n }, () => 10) // +10%
    const { rawPaceSecPerKm, gapPaceSecPerKm } = gradeAdjustedPace(
      distance,
      time,
      grade,
    )
    expect(gapPaceSecPerKm as number).toBeLessThan(rawPaceSecPerKm as number)
  })

  it('treats absent grade samples as flat (gap ≈ raw)', () => {
    // grade shorter / sparse → missing indices fall back to 0
    const { rawPaceSecPerKm, gapPaceSecPerKm } = gradeAdjustedPace(
      distance,
      time,
      [],
    )
    expect(gapPaceSecPerKm).toBeCloseTo(rawPaceSecPerKm as number, 6)
  })
})

describe('timeInZones', () => {
  it('splits inter-sample time by the starting HR sample', () => {
    // 4 intervals: Z2, Z2, Z4, Z4 → 50 / 50.
    const time = [0, 1, 2, 3, 4]
    const hr = [130, 130, 170, 170, 170]
    const pct = timeInZones(hr, time)
    expect(pct['Z2 Aerobic']).toBeCloseTo(50, 6)
    expect(pct['Z4 Threshold']).toBeCloseTo(50, 6)
    expect(pct['Z1 Recovery']).toBe(0)
    expect(pct['Z3 Tempo']).toBe(0)
    expect(pct['Z5 VO₂max']).toBe(0)
    const sum = Object.values(pct).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(100, 6)
  })

  it('returns all-zero for empty or single-sample input', () => {
    expect(Object.values(timeInZones([], [])).every((v) => v === 0)).toBe(true)
    expect(
      Object.values(timeInZones([150], [0])).every((v) => v === 0),
    ).toBe(true)
  })
})

describe('aerobicDecoupling', () => {
  // 50-minute steady run at 3 m/s, HR rising 140 → 160.
  const n = 301
  const time = Array.from({ length: n }, (_, i) => i * 10) // 0..3000s
  const distance = Array.from({ length: n }, (_, i) => i * 30) // 3 m/s
  const risingHr = Array.from({ length: n }, (_, i) => 140 + (i / 300) * 20)

  it('is positive for a steady run with upward HR drift', () => {
    const d = aerobicDecoupling(distance, time, risingHr)
    expect(d.applicable).toBe(true)
    if (d.applicable) {
      // Hand calc: (1 - meanHR₁/meanHR₂) × 100 ≈ 6.45%
      expect(d.pct).toBeGreaterThan(5)
      expect(d.pct).toBeLessThan(8)
    }
  })

  it('is n/a without heart rate', () => {
    expect(aerobicDecoupling(distance, time, []).applicable).toBe(false)
  })

  it('is n/a for a short run', () => {
    const shortN = 60 // 590s < 45 min
    const t = Array.from({ length: shortN }, (_, i) => i * 10)
    const dist = Array.from({ length: shortN }, (_, i) => i * 30)
    const hr = Array.from({ length: shortN }, () => 150)
    expect(aerobicDecoupling(dist, t, hr).applicable).toBe(false)
  })

  it('is n/a for an interval workout (high speed variability)', () => {
    // Alternating 1 / 5 m/s → high CV, even though long enough.
    const dist: number[] = [0]
    for (let i = 1; i < n; i++) dist.push(dist[i - 1] + (i % 2 ? 10 : 50))
    const hr = Array.from({ length: n }, () => 150)
    expect(aerobicDecoupling(dist, time, hr).applicable).toBe(false)
  })
})

describe('buildSeries', () => {
  const n = 1005
  const time = Array.from({ length: n }, (_, i) => i)
  const distance = Array.from({ length: n }, (_, i) => i * 2)

  it('downsamples to ≤ target and preserves both endpoints', () => {
    const target = 100
    const rows = buildSeries({ time, distance }, target)
    expect(rows.length).toBeLessThanOrEqual(target)
    expect(rows[0].t).toBe(time[0])
    expect(rows[0].distM).toBe(distance[0])
    expect(rows[rows.length - 1].t).toBe(time[n - 1])
    expect(rows[rows.length - 1].distM).toBe(distance[n - 1])
  })

  it('omits fields for absent channels', () => {
    const rows = buildSeries({ time: [0, 1], distance: [0, 5] })
    expect(rows[0].hr).toBeUndefined()
    expect(rows[0].elev).toBeUndefined()
    expect(rows[0].cad).toBeUndefined()
    expect(rows[0].grade).toBeUndefined()
    expect(rows[0].paceSecPerKm).toBeUndefined()
  })

  it('handles single and zero samples', () => {
    expect(buildSeries({ time: [5], distance: [100] })).toEqual([
      { t: 5, distM: 100 },
    ])
    expect(buildSeries({ time: [], distance: [] })).toEqual([])
  })

  it('derives pace from velocity and skips paused samples', () => {
    const rows = buildSeries({
      time: [0, 1, 2],
      distance: [0, 2.5, 2.5],
      velocity: [2.5, 2.5, 0],
    })
    expect(rows[0].paceSecPerKm).toBeCloseTo(400, 6) // 1000 / 2.5
    expect(rows[2].paceSecPerKm).toBeUndefined() // v=0 → paused
  })

  it('adds a grade-adjusted pace that is faster uphill', () => {
    const rows = buildSeries({
      time: [0, 1, 2],
      distance: [0, 3, 6],
      velocity: [3, 3, 3],
      grade: [10, 10, 10],
    })
    expect(rows[0].gapPaceSecPerKm as number).toBeLessThan(
      rows[0].paceSecPerKm as number,
    )
  })
})
