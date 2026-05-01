/**
 * Pace formatting helpers specific to the Records feature.
 *
 * Date helpers live in `lib/dates.ts` (shared across features).
 */

import { KM_PER_MI, type Unit } from '@/lib/activities'

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
