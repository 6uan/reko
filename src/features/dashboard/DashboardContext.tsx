/**
 * Shared context for the dashboard layout and its child tab routes.
 *
 * Provides loader data (activities, runs, records) and mutable client
 * state (unit toggle) to every tab without prop-drilling through the
 * Outlet boundary. Child routes call `useDashboard()` to access.
 */

import { createContext, useContext, useMemo, useState } from 'react'
import { activityKind, type Activity, type Unit } from '@/lib/activities'
import { filterByRange, type RangeKey } from './range'
import type { RecordsData } from './records/distances'

type DashboardContextValue = {
  /** Activities (runs + walks) scoped to the selected time range. */
  activities: Activity[]
  /** Runs only, scoped to the selected time range. */
  runs: Activity[]
  /** All activities, ignoring the range — for inherently all-time views. */
  allActivities: Activity[]
  /** All runs, ignoring the range (e.g. Records PR progression). */
  allRuns: Activity[]
  /** Pre-aggregated records data (all-time by nature). */
  records: RecordsData
  /** Current distance unit. */
  unit: Unit
  /** Switch between km / mi. Persists to localStorage. */
  toggleUnit: (u: Unit) => void
  /** Selected time range. Persists to localStorage. */
  range: RangeKey
  /** Change the active time range. */
  setRange: (r: RangeKey) => void
}

const Ctx = createContext<DashboardContextValue | null>(null)

export function useDashboard() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDashboard must be used within DashboardProvider')
  return v
}

type ProviderProps = {
  activities: Activity[]
  records: RecordsData
  children: React.ReactNode
}

export function DashboardProvider({ activities, records, children }: ProviderProps) {
  const [unit, setUnit] = useState<Unit>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reko-unit') as Unit) || 'mi'
    }
    return 'mi'
  })

  const toggleUnit = (u: Unit) => {
    setUnit(u)
    if (typeof window !== 'undefined') localStorage.setItem('reko-unit', u)
  }

  const [range, setRangeState] = useState<RangeKey>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reko-range') as RangeKey) || 'all'
    }
    return 'all'
  })

  const setRange = (r: RangeKey) => {
    setRangeState(r)
    if (typeof window !== 'undefined') localStorage.setItem('reko-range', r)
  }

  const allRuns = useMemo(
    () => activities.filter((a) => activityKind(a) === 'run'),
    [activities],
  )

  // Range-scoped views — what the analytical tabs consume by default.
  const scopedActivities = useMemo(
    () => filterByRange(activities, range),
    [activities, range],
  )
  const scopedRuns = useMemo(() => filterByRange(allRuns, range), [allRuns, range])

  const value = useMemo<DashboardContextValue>(
    () => ({
      activities: scopedActivities,
      runs: scopedRuns,
      allActivities: activities,
      allRuns,
      records,
      unit,
      toggleUnit,
      range,
      setRange,
    }),
    [scopedActivities, scopedRuns, activities, allRuns, records, unit, range],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
