import { describe, it, expect } from 'vitest'
import {
  filterByRange,
  yearsInData,
  periodLabel,
  monthWindow,
  rangeOptionsForYears,
  normalizeRangeForYears,
  isRangeKeyForYears,
} from '@/features/dashboard/range'

const mk = (date: string) => ({ date })

describe('filterByRange', () => {
  const items = [
    mk('2024-03-15T12:00:00Z'),
    mk('2025-06-10T12:00:00Z'),
    mk('2026-01-15T12:00:00Z'),
  ]
  const now = new Date('2026-06-22T12:00:00Z')

  it('returns everything for "all"', () => {
    expect(filterByRange(items, 'all', now)).toHaveLength(3)
  })

  it('"ytd" keeps only the current calendar year', () => {
    expect(filterByRange(items, 'ytd', now).map((i) => i.date)).toEqual([
      '2026-01-15T12:00:00Z',
    ])
  })

  it('"12m" keeps the trailing twelve months', () => {
    expect(filterByRange(items, '12m', now).map((i) => i.date)).toEqual([
      '2026-01-15T12:00:00Z',
    ])
  })

  it('"12m" filter agrees with the volume-chart window at the month boundary', () => {
    // A run before the window's first-of-month start must be excluded by the
    // filter too, so KPI totals and the volume chart reconcile (regression).
    const boundary = [
      mk('2025-06-25T12:00:00Z'), // within trailing 365d, before window start
      mk('2025-07-05T12:00:00Z'), // inside the calendar-month window
    ]
    const win = monthWindow('12m', new Date('2024-01-01T00:00:00Z'), now)
    const kept = filterByRange(boundary, '12m', now)
    expect(kept.every((i) => new Date(i.date) >= win.start)).toBe(true)
    expect(kept.map((i) => i.date)).toEqual(['2025-07-05T12:00:00Z'])
  })

  it('a year key keeps only that calendar year', () => {
    expect(filterByRange(items, '2024', now).map((i) => i.date)).toEqual([
      '2024-03-15T12:00:00Z',
    ])
  })
})

describe('yearsInData', () => {
  it('returns distinct years, newest first', () => {
    expect(
      yearsInData([
        mk('2024-03-15T12:00:00Z'),
        mk('2026-01-15T12:00:00Z'),
        mk('2024-12-01T12:00:00Z'),
      ]),
    ).toEqual([2026, 2024])
  })
})

describe('rangeOptionsForYears', () => {
  const now = new Date('2026-06-22T12:00:00Z')

  it('omits "This year" when the current year is already selectable', () => {
    expect(rangeOptionsForYears([2026, 2025], now).map((o) => o.label)).toEqual([
      'All time',
      'Last 12 months',
      '2026',
      '2025',
    ])
  })

  it('keeps "This year" when it is not duplicated by a data year', () => {
    expect(rangeOptionsForYears([2025], now).map((o) => o.label)).toEqual([
      'All time',
      'This year',
      'Last 12 months',
      '2025',
    ])
  })
})

describe('normalizeRangeForYears', () => {
  const now = new Date('2026-06-22T12:00:00Z')

  it('normalizes a persisted ytd selection to the concrete current year', () => {
    expect(normalizeRangeForYears('ytd', [2026, 2025], now)).toBe('2026')
  })

  it('leaves ytd alone when the current year is not a selectable data year', () => {
    expect(normalizeRangeForYears('ytd', [2025], now)).toBe('ytd')
  })
})

describe('isRangeKeyForYears', () => {
  it('accepts presets and years present in the data', () => {
    expect(isRangeKeyForYears('all', [2026, 2025])).toBe(true)
    expect(isRangeKeyForYears('12m', [2026, 2025])).toBe(true)
    expect(isRangeKeyForYears('2026', [2026, 2025])).toBe(true)
  })

  it('rejects invalid strings and years not present in the data', () => {
    expect(isRangeKeyForYears('soon', [2026, 2025])).toBe(false)
    expect(isRangeKeyForYears('2024', [2026, 2025])).toBe(false)
  })
})

describe('periodLabel', () => {
  it('labels presets and years', () => {
    expect(periodLabel('all')).toBe('All time')
    expect(periodLabel('ytd')).toBe('This year')
    expect(periodLabel('2024')).toBe('2024')
  })
})

describe('monthWindow', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  const dataStart = new Date('2024-03-10T12:00:00Z')

  const monthCount = (w: { start: Date; end: Date }) => {
    let count = 0
    const d = new Date(w.start)
    while (d <= w.end) {
      count++
      d.setMonth(d.getMonth() + 1)
    }
    return count
  }

  it('a specific year spans exactly 12 months', () => {
    expect(monthCount(monthWindow('2025', dataStart, now))).toBe(12)
  })

  it('"12m" spans 12 months ending at the current month', () => {
    expect(monthCount(monthWindow('12m', dataStart, now))).toBe(12)
  })

  it('"ytd" spans January through the current month', () => {
    expect(monthCount(monthWindow('ytd', dataStart, now))).toBe(6)
  })

  it('"all" spans from the first activity to now', () => {
    expect(monthCount(monthWindow('all', dataStart, now))).toBe(28)
  })
})
