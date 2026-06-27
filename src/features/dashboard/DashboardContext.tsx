/**
 * Shared context for the dashboard layout and its child tab routes.
 *
 * Provides loader data (activities, runs, records) and mutable client
 * state (unit toggle) to every tab without prop-drilling through the
 * Outlet boundary. Child routes call `useDashboard()` to access.
 */

import { createContext, useContext, useMemo, useState } from 'react'
import { activityKind, type Activity, type Unit } from '@/lib/activities'
import {
  filterByRange,
  normalizeRangeForYears,
  yearsInData,
  type RangeKey,
} from './range'
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
  /** Include TrailRun activities in run views. Persists to localStorage. */
  includeTrail: boolean
  setIncludeTrail: (v: boolean) => void
  /** Include VirtualRun (treadmill) activities in run views. */
  includeTreadmill: boolean
  setIncludeTreadmill: (v: boolean) => void
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

  const availableYears = useMemo(() => yearsInData(activities), [activities])
  const activeRange = useMemo(
    () => normalizeRangeForYears(range, availableYears),
    [range, availableYears],
  )

  // Run-type inclusion toggles (default on, so behaviour matches "all runs").
  const [includeTrail, setIncludeTrailState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('reko-include-trail') !== 'false'
    }
    return true
  })
  const setIncludeTrail = (v: boolean) => {
    setIncludeTrailState(v)
    if (typeof window !== 'undefined')
      localStorage.setItem('reko-include-trail', String(v))
  }

  const [includeTreadmill, setIncludeTreadmillState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('reko-include-treadmill') !== 'false'
    }
    return true
  })
  const setIncludeTreadmill = (v: boolean) => {
    setIncludeTreadmillState(v)
    if (typeof window !== 'undefined')
      localStorage.setItem('reko-include-treadmill', String(v))
  }

  const allRuns = useMemo(
    () =>
      activities.filter((a) => {
        if (activityKind(a) !== 'run') return false
        const sport = a.sportType ?? a.type
        if (!includeTrail && sport === 'TrailRun') return false
        if (!includeTreadmill && sport === 'VirtualRun') return false
        return true
      }),
    [activities, includeTrail, includeTreadmill],
  )

  // Range-scoped views — what the analytical tabs consume by default.
  const scopedActivities = useMemo(
    () => filterByRange(activities, activeRange),
    [activities, activeRange],
  )
  const scopedRuns = useMemo(
    () => filterByRange(allRuns, activeRange),
    [allRuns, activeRange],
  )

  const value = useMemo<DashboardContextValue>(
    () => ({
      activities: scopedActivities,
      runs: scopedRuns,
      allActivities: activities,
      allRuns,
      records,
      unit,
      toggleUnit,
      range: activeRange,
      setRange,
      includeTrail,
      setIncludeTrail,
      includeTreadmill,
      setIncludeTreadmill,
    }),
    [
      scopedActivities,
      scopedRuns,
      activities,
      allRuns,
      records,
      unit,
      activeRange,
      includeTrail,
      includeTreadmill,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
