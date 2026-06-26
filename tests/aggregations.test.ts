import { describe, it, expect } from 'vitest'
import { groupByWeek, trendDelta } from '@/lib/aggregations'
import type { WeekBucket } from '@/lib/aggregations'
import { getMonday } from '@/lib/dates'

/**
 * Fixture: an item carrying a date string and a value. groupByWeek is
 * generic over the item shape via accessor functions, so we use a minimal
 * record.
 */
type Item = { date: string; value: number | null | undefined }
const mk = (date: string, value: number | null | undefined): Item => ({
  date,
  value,
})

const date = (i: Item) => i.date
const value = (i: Item) => i.value

/**
 * Mirror the source's week-key derivation so label assertions stay correct
 * regardless of the host timezone (getMonday uses local getters, while the
 * source builds the label from `new Date(weekKey)`).
 */
const weekKeyOf = (iso: string) =>
  getMonday(new Date(iso)).toISOString().slice(0, 10)
const labelOf = (weekKey: string) => {
  const d = new Date(weekKey)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

describe('groupByWeek', () => {
  it('returns an empty array for no items', () => {
    expect(groupByWeek<Item>([], date, value)).toEqual([])
  })

  it('groups same-week items and averages their values', () => {
    // Three dates inside one Mon-Sun week (Apr 6 2026 is a Monday).
    const items = [
      mk('2026-04-07T12:00:00Z', 10),
      mk('2026-04-09T12:00:00Z', 20),
      mk('2026-04-10T12:00:00Z', 30),
    ]
    const out = groupByWeek(items, date, value)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(3)
    expect(out[0].avg).toBeCloseTo(20, 6)
    // week key + label derived the same way the source does.
    expect(out[0].week).toBe(weekKeyOf('2026-04-07T12:00:00Z'))
    expect(out[0].label).toBe(labelOf(out[0].week))
  })

  it('skips null, undefined, zero, and negative values', () => {
    const items = [
      mk('2026-04-07T12:00:00Z', null),
      mk('2026-04-07T12:00:00Z', undefined),
      mk('2026-04-07T12:00:00Z', 0),
      mk('2026-04-07T12:00:00Z', -5),
      mk('2026-04-07T12:00:00Z', 42),
    ]
    const out = groupByWeek(items, date, value)
    expect(out).toHaveLength(1)
    expect(out[0].count).toBe(1)
    expect(out[0].avg).toBeCloseTo(42, 6)
  })

  it('drops a week entirely when all its values are skipped', () => {
    const items = [mk('2026-04-07T12:00:00Z', 0), mk('2026-04-08T12:00:00Z', null)]
    expect(groupByWeek(items, date, value)).toEqual([])
  })

  it('sorts buckets ascending by week (chronological)', () => {
    // Provided out of order across three distinct weeks.
    const items = [
      mk('2026-04-20T12:00:00Z', 5), // week of Apr 20
      mk('2026-04-06T12:00:00Z', 5), // week of Apr 6
      mk('2026-04-13T12:00:00Z', 5), // week of Apr 13
    ]
    const weeks = groupByWeek(items, date, value).map((b) => b.week)
    const sorted = [...weeks].sort((a, b) => a.localeCompare(b))
    expect(weeks).toEqual(sorted)
    expect(weeks).toHaveLength(3)
  })

  it('does not round by default but rounds when asked', () => {
    // Two values averaging 15.5.
    const items = [
      mk('2026-04-07T12:00:00Z', 10),
      mk('2026-04-08T12:00:00Z', 21),
    ]
    expect(groupByWeek(items, date, value)[0].avg).toBeCloseTo(15.5, 6)
    expect(groupByWeek(items, date, value, { round: true })[0].avg).toBe(16)
  })

  it('separates items that fall in adjacent weeks', () => {
    // Sun Apr 5 belongs to the prior week; Mon Apr 6 starts a new one.
    const items = [
      mk('2026-04-06T12:00:00Z', 100), // Monday → its own week
      mk('2026-04-13T12:00:00Z', 200), // next Monday → next week
    ]
    const out = groupByWeek(items, date, value)
    expect(out).toHaveLength(2)
    expect(out.map((b) => b.count)).toEqual([1, 1])
  })
})

describe('trendDelta', () => {
  const bucket = (avg: number): WeekBucket => ({
    week: '2026-01-01',
    label: '1/1',
    avg,
    count: 1,
  })

  it('returns 0 with fewer than two buckets', () => {
    expect(trendDelta([])).toBe(0)
    expect(trendDelta([bucket(50)])).toBe(0)
  })

  it('computes second-half minus first-half (even count)', () => {
    // mid = ceil(4/2) = 2. first = avg(10,20)=15, last = avg(30,40)=35.
    const out = trendDelta([bucket(10), bucket(20), bucket(30), bucket(40)])
    expect(out).toBe(20)
  })

  it('puts the middle bucket in the second half (odd count)', () => {
    // mid = ceil(3/2) = 2. first = avg(10,20)=15, last = avg(30)=30 → 15.
    expect(trendDelta([bucket(10), bucket(20), bucket(30)])).toBe(15)
  })

  it('is negative for a downward trend', () => {
    // mid = 2. first = avg(100,80)=90, last = avg(40,20)=30 → -60.
    expect(trendDelta([bucket(100), bucket(80), bucket(40), bucket(20)])).toBe(
      -60,
    )
  })

  it('rounds the delta to an integer', () => {
    // mid = 1. first = 10, last = 11.4 → round(1.4) = 1.
    expect(trendDelta([bucket(10), bucket(11.4)])).toBe(1)
    // first = 10, last = 11.6 → round(1.6) = 2.
    expect(trendDelta([bucket(10), bucket(11.6)])).toBe(2)
  })

  it('is 0 for a flat trend', () => {
    expect(trendDelta([bucket(50), bucket(50), bucket(50)])).toBe(0)
  })
})
