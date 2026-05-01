import { getMonday } from '../../lib/strava'

export function isSameWeek(d1: Date, d2: Date): boolean {
  return getMonday(d1).getTime() === getMonday(d2).getTime()
}

export function isSameMonth(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth()
  )
}

export function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}
