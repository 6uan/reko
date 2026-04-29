/**
 * Shared format helpers and table primitives for the Records feature.
 *
 * Consumed by HeroPR, DistanceRow, PaceByRange, PRHistory, and the
 * main RecordsTab component. Keeping them here avoids every component
 * file re-implementing the same date/pace formatting.
 */

import { KM_PER_MI, type Unit } from '../../../lib/activities'

// ── Date helpers ─────────────────────────────────────────────────

/**
 * Wall-clock string ("YYYY-MM-DD HH:MM:SS") → Date. We append `Z` so
 * Date.parse interprets the wall-clock as UTC — matches what the
 * dashboard loader does for activities, keeping Mar 12 → Mar 12 across
 * server (UTC) and browser (local).
 */
export function parseLocalDate(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z')
}

export function formatDate(s: string): string {
  return parseLocalDate(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function relTime(s: string, now: Date): string {
  const days = Math.floor(
    (now.getTime() - parseLocalDate(s).getTime()) / 86400000,
  )
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const y = Math.floor(days / 365)
  return `${y} year${y > 1 ? 's' : ''} ago`
}

export function isRecent(s: string, now: Date, days: number): boolean {
  return (now.getTime() - parseLocalDate(s).getTime()) / 86400000 < days
}

// ── Pace helpers ─────────────────────────────────────────────────

export function paceForDist(seconds: number, meters: number, unit: Unit) {
  const dist = unit === 'km' ? meters / 1000 : meters / KM_PER_MI
  return seconds / dist
}

export function formatPace(paceSec: number): string {
  if (!Number.isFinite(paceSec) || paceSec <= 0) return '—'
  const m = Math.floor(paceSec / 60)
  const s = Math.round(paceSec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
