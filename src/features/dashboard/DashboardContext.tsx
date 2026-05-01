/**
 * Shared context for the dashboard layout and its child tab routes.
 *
 * Provides loader data (activities, runs, records) and mutable client
 * state (unit toggle) to every tab without prop-drilling through the
 * Outlet boundary. Child routes call `useDashboard()` to access.
 */

import { createContext, useContext, useMemo, useState } from 'react'
import { activityKind, type Activity, type Unit } from '@/lib/activities'
import type { RecordsData } from './records/distances'

type DashboardContextValue = {
  /** All activities (runs + walks). */
  activities: Activity[]
  /** Runs only — filtered from activities. */
  runs: Activity[]
  /** Pre-aggregated records data. */
  records: RecordsData
  /** Current distance unit. */
  unit: Unit
  /** Switch between km / mi. Persists to localStorage. */
  toggleUnit: (u: Unit) => void
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

  const runs = useMemo(
    () => activities.filter((a) => activityKind(a) === 'run'),
    [activities],
  )

  const value = useMemo<DashboardContextValue>(
    () => ({ activities, runs, records, unit, toggleUnit }),
    [activities, runs, records, unit],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
