/**
 * Global dashboard time-range model.
 *
 * The selected range scopes which activities the analytical tabs see. It's
 * applied centrally in DashboardContext (see its `runs` / `activities`) so
 * every tab inherits it without extra wiring; surfaces that are inherently
 * all-time — e.g. Records PRs — read the `all*` lists instead.
 */

/** A selected range: a preset key, or a 4-digit year as a string ('2024'). */
export type RangeKey = 'all' | 'ytd' | '12m' | `${number}`
export type RangeOption = { key: RangeKey; label: string }

/** Fixed presets, in display order. Years with data are appended in the UI. */
export const RANGE_PRESETS: RangeOption[] = [
  { key: 'all', label: 'All time' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
]

/** Validate a persisted range before trusting it as app state. */
export function isRangeKeyForYears(
  value: string,
  years: number[],
): value is RangeKey {
  if (RANGE_PRESETS.some((preset) => preset.key === value)) return true

  if (!/^\d{4}$/.test(value)) return false
  return years.includes(Number(value))
}

/** Human label for any range key — a preset label, or the year itself. */
export function periodLabel(key: RangeKey): string {
  return RANGE_PRESETS.find((p) => p.key === key)?.label ?? String(key)
}

/** Distinct calendar years present in the data, newest first. */
export function yearsInData(items: { date: string }[]): number[] {
  const years = new Set<number>()
  for (const i of items) years.add(new Date(i.date).getFullYear())
  return [...years].sort((a, b) => b - a)
}

/** Dropdown options derived from actual data years. */
export function rangeOptionsForYears(
  years: number[],
  now: Date = new Date(),
): RangeOption[] {
  const currentYear = now.getFullYear()
  const presets = RANGE_PRESETS.filter(
    (p) => p.key !== 'ytd' || !years.includes(currentYear),
  )

  return [
    ...presets,
    ...years.map((year) => ({
      key: String(year) as RangeKey,
      label: String(year),
    })),
  ]
}

/** Replace duplicate relative selections with the equivalent concrete year. */
export function normalizeRangeForYears(
  key: RangeKey,
  years: number[],
  now: Date = new Date(),
): RangeKey {
  const currentYear = now.getFullYear()
  if (key === 'ytd' && years.includes(currentYear)) {
    return String(currentYear) as RangeKey
  }
  return key
}

/**
 * Filter dated items to the selected range. `now` is injectable for tests and
 * defaults to the current time.
 *
 *  - `all` → everything
 *  - `ytd` → the current calendar year
 *  - `12m` → the trailing twelve calendar months
 *  - a year string ('2024') → that calendar year
 */
export function filterByRange<T extends { date: string }>(
  items: T[],
  key: RangeKey,
  now: Date = new Date(),
): T[] {
  if (key === 'all') return items

  if (key === 'ytd') {
    const year = now.getFullYear()
    return items.filter((i) => new Date(i.date).getFullYear() === year)
  }

  if (key === '12m') {
    // Trailing 12 calendar months. Must match monthWindow('12m') below so the
    // KPI/filter set and the volume chart's x-axis share one boundary — else a
    // run in the partial first month counts in the KPIs but vanishes from the
    // chart. (Also sidesteps the leap-day edge of setFullYear.)
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    return items.filter((i) => new Date(i.date) >= cutoff)
  }

  const year = Number(key)
  if (Number.isInteger(year)) {
    return items.filter((i) => new Date(i.date).getFullYear() === year)
  }

  return items
}

/**
 * First-of-month [start, end] window for the volume chart's x-axis, so the
 * bars span the selected range rather than always running to today (a year
 * gives exactly 12 months). `dataStart` — the earliest activity — is used
 * only for the open-ended `all` range.
 */
export function monthWindow(
  key: RangeKey,
  dataStart: Date,
  now: Date = new Date(),
): { start: Date; end: Date } {
  const firstOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

  if (key === 'ytd') {
    return { start: new Date(now.getFullYear(), 0, 1), end: firstOfMonth(now) }
  }
  if (key === '12m') {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
      end: firstOfMonth(now),
    }
  }
  const year = Number(key)
  if (Number.isInteger(year)) {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 1) }
  }
  return { start: firstOfMonth(dataStart), end: firstOfMonth(now) }
}
