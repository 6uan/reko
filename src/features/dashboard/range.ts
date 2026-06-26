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

/** Fixed presets, in display order. Years with data are appended in the UI. */
export const RANGE_PRESETS: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'All time' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
]

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
