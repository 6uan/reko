import { useMemo } from 'react'
import { getMonday } from '../../lib/strava'
import {
  KM_PER_MI,
  paceForUnit,
  type Activity,
  type Unit,
} from '../../lib/activities'
import { isSameWeek, isSameMonth } from './helpers'
import KpiCards from './components/KpiCards'
import VolumeChart, { type MonthBucket } from './components/VolumeChart'
import PaceChart, { type PacePoint } from './components/PaceChart'
import RecentRunsTable from './components/RecentRunsTable'

type Props = {
  runs: Activity[]
  unit: Unit
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MONTH_NAMES_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function Overview({ runs, unit }: Props) {
  const today = useMemo(() => new Date(), [])

  // ── KPI data ──────────────────────────────────────────────────────

  const thisWeekRuns = useMemo(
    () => runs.filter((r) => isSameWeek(new Date(r.date), today)),
    [runs, today],
  )

  const lastWeekRuns = useMemo(() => {
    const d = new Date(today)
    d.setDate(d.getDate() - 7)
    return runs.filter((r) => isSameWeek(new Date(r.date), d))
  }, [runs, today])

  const thisMonthRuns = useMemo(
    () => runs.filter((r) => isSameMonth(new Date(r.date), today)),
    [runs, today],
  )

  const lastMonthRuns = useMemo(() => {
    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    return runs.filter((r) => isSameMonth(new Date(r.date), lm))
  }, [runs, today])

  const thisWeekDist = thisWeekRuns.reduce((s, r) => s + r.distanceMeters, 0)
  const lastWeekDist = lastWeekRuns.reduce((s, r) => s + r.distanceMeters, 0)

  const avgPaceThis = useMemo(() => {
    if (thisMonthRuns.length === 0) return 0
    return (
      thisMonthRuns.reduce((s, r) => s + paceForUnit(r.avgSpeed, unit), 0) /
      thisMonthRuns.length
    )
  }, [thisMonthRuns, unit])

  const avgPaceLast = useMemo(() => {
    if (lastMonthRuns.length === 0) return 0
    return (
      lastMonthRuns.reduce((s, r) => s + paceForUnit(r.avgSpeed, unit), 0) /
      lastMonthRuns.length
    )
  }, [lastMonthRuns, unit])

  const thisMonthDist = thisMonthRuns.reduce((s, r) => s + r.distanceMeters, 0)
  const lastMonthDist = lastMonthRuns.reduce((s, r) => s + r.distanceMeters, 0)
  const thisMonthTime = thisMonthRuns.reduce((s, r) => s + r.movingTime, 0)
  const lastMonthTime = lastMonthRuns.reduce((s, r) => s + r.movingTime, 0)

  // ── Volume chart data (12 trailing months) ────────────────────────

  const monthlyBuckets = useMemo<MonthBucket[]>(() => {
    const buckets: MonthBucket[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const year = d.getFullYear()
      const month = d.getMonth()
      const label = MONTH_NAMES_SHORT[month]
      const fullLabel = `${MONTH_NAMES_FULL[month]} ${year}`

      const monthRuns = runs.filter((r) => {
        const rd = new Date(r.date)
        return rd.getFullYear() === year && rd.getMonth() === month
      })

      const distMeters = monthRuns.reduce((s, r) => s + r.distanceMeters, 0)
      const time = monthRuns.reduce((s, r) => s + r.movingTime, 0)
      const totalPace = monthRuns.reduce(
        (s, r) => s + paceForUnit(r.avgSpeed, unit),
        0,
      )
      const avgPace = monthRuns.length > 0 ? totalPace / monthRuns.length : 0

      buckets.push({
        label,
        fullLabel,
        distance: unit === 'mi' ? distMeters / KM_PER_MI : distMeters / 1000,
        distanceMeters: distMeters,
        runs: monthRuns.length,
        time,
        avgPace,
      })
    }
    return buckets
  }, [runs, today, unit])

  // ── Pace chart data (13 trailing weeks) ───────────────────────────

  const paceData = useMemo<PacePoint[]>(() => {
    const points: PacePoint[] = []
    for (let i = 12; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i * 7)
      const mon = getMonday(d)
      const sun = new Date(mon)
      sun.setDate(sun.getDate() + 6)

      const weekRuns = runs.filter(
        (r) => getMonday(new Date(r.date)).getTime() === mon.getTime(),
      )
      if (weekRuns.length === 0) continue

      const avg =
        weekRuns.reduce((s, r) => s + paceForUnit(r.avgSpeed, unit), 0) /
        weekRuns.length

      const label = `${mon.getMonth() + 1}/${mon.getDate()}`
      const fullLabel = `${MONTH_NAMES_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_NAMES_SHORT[sun.getMonth()]} ${sun.getDate()}`

      points.push({ label, fullLabel, pace: avg, runs: weekRuns.length })
    }
    return points
  }, [runs, today, unit])

  // ── Recent runs (8 most recent this month) ────────────────────────

  const recentRuns = useMemo(
    () =>
      [...thisMonthRuns]
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        .slice(0, 8),
    [thisMonthRuns],
  )

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <KpiCards
        thisWeekDist={thisWeekDist}
        lastWeekDist={lastWeekDist}
        avgPaceThis={avgPaceThis}
        avgPaceLast={avgPaceLast}
        thisMonthDist={thisMonthDist}
        lastMonthDist={lastMonthDist}
        thisMonthRunCount={thisMonthRuns.length}
        thisMonthTime={thisMonthTime}
        lastMonthTime={lastMonthTime}
        unit={unit}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VolumeChart data={monthlyBuckets} unit={unit} />
        <PaceChart data={paceData} unit={unit} />
      </div>

      <RecentRunsTable runs={recentRuns} unit={unit} />
    </div>
  )
}
