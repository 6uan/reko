/**
 * Shared date helpers.
 *
 * Two date formats flow through the app:
 *  - **ISO strings** ("2026-04-24T14:30:00Z") — what `Activity.date` carries
 *    after the activities loader normalizes Strava's wall-clock timestamps.
 *  - **Wall-clock strings** ("YYYY-MM-DD HH:MM:SS") — Strava's raw
 *    `startDateLocal` field, used directly in the Records feature.
 *
 * `formatDate` / `formatDateShort` accept either via `toDate`.
 * `parseLocalDate` is exported for code that needs a Date object from the
 * wall-clock format specifically.
 */

/**
 * Wall-clock string → Date. We append `Z` so Date.parse interprets the
 * string as UTC instead of local time, keeping a Mar 12 activity → Mar 12
 * across server (UTC) and browser (local).
 */
export function parseLocalDate(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z')
}

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input
  // ISO ("...T..."): parses natively.
  if (input.includes('T')) return new Date(input)
  // Wall-clock ("YYYY-MM-DD HH:MM:SS"): treat as UTC.
  return parseLocalDate(input)
}

/** "Apr 24, 2026" — full date with year. */
export function formatDate(input: string | Date): string {
  return toDate(input).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/** "Apr 24" — month + day, for lists where the year is implied. */
export function formatDateShort(input: string | Date): string {
  return toDate(input).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Given any date, return Monday 00:00 of the week containing it. Used as
 * a stable bucket key for weekly aggregations (trend charts).
 */
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setHours(0, 0, 0, 0)
  d.setDate(diff)
  return d
}

/**
 * "today" / "yesterday" / "5 days ago" / "3 weeks ago" / "2 months ago" /
 * "1 year ago". `now` is passed in so callers can memoize a reference time
 * for a list of items (avoids drift across renders).
 */
export function formatRelativeTime(input: string | Date, now: Date): string {
  const days = Math.floor(
    (now.getTime() - toDate(input).getTime()) / 86400000,
  )
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const y = Math.floor(days / 365)
  return `${y} year${y > 1 ? 's' : ''} ago`
}
