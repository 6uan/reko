import { useMemo } from 'react'
import { getMonday } from '@/lib/strava'
import {
  KM_PER_MI,
  paceForUnit,
  avg,
  type Activity,
  type Unit,
} from '@/lib/activities'
import KpiCards from './KpiCards'
import VolumeChart, { type MonthBucket } from './VolumeChart'
import PaceChart, { type PacePoint } from './PaceChart'
import RecentRunsTable from './RecentRunsTable'

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
  // ── KPI data (all time) ───────────────────────────────────────────

  const totalDist = useMemo(
    () => runs.reduce((s, r) => s + r.distanceMeters, 0),
    [runs],
  )

  const avgPace = useMemo(() => {
    const valid = runs.filter((r) => r.avgSpeed > 0)
    if (!valid.length) return 0
    return avg(valid.map((r) => paceForUnit(r.avgSpeed, unit)))
  }, [runs, unit])

  const totalTime = useMemo(
    () => runs.reduce((s, r) => s + r.movingTime, 0),
    [runs],
  )

  // ── Volume chart data (all months with data) ─────────────────────

  const monthlyBuckets = useMemo<MonthBucket[]>(() => {
    if (!runs.length) return []

    const sorted = [...runs].sort((a, b) => a.date.localeCompare(b.date))
    const first = new Date(sorted[0].date)
    const now = new Date()

    const buckets: MonthBucket[] = []
    const d = new Date(first.getFullYear(), first.getMonth(), 1)

    while (d <= now) {
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
      const monthAvgPace = monthRuns.length > 0 ? totalPace / monthRuns.length : 0

      buckets.push({
        label,
        fullLabel,
        distance: unit === 'mi' ? distMeters / KM_PER_MI : distMeters / 1000,
        distanceMeters: distMeters,
        runs: monthRuns.length,
        time,
        avgPace: monthAvgPace,
      })

      d.setMonth(d.getMonth() + 1)
    }

    return buckets
  }, [runs, unit])

  // ── Pace chart data (all weeks with data) ─────────────────────────

  const paceData = useMemo<PacePoint[]>(() => {
    if (!runs.length) return []

    const buckets = new Map<number, { runs: Activity[]; mon: Date }>()
    for (const r of runs) {
      const mon = getMonday(new Date(r.date))
      const key = mon.getTime()
      if (!buckets.has(key)) buckets.set(key, { runs: [], mon })
      buckets.get(key)!.runs.push(r)
    }

    return [...buckets.values()]
      .sort((a, b) => a.mon.getTime() - b.mon.getTime())
      .map(({ runs: weekRuns, mon }) => {
        const sun = new Date(mon)
        sun.setDate(sun.getDate() + 6)
        const weekAvg =
          weekRuns.reduce((s, r) => s + paceForUnit(r.avgSpeed, unit), 0) /
          weekRuns.length

        return {
          label: `${mon.getMonth() + 1}/${mon.getDate()}`,
          fullLabel: `${MONTH_NAMES_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_NAMES_SHORT[sun.getMonth()]} ${sun.getDate()}`,
          pace: weekAvg,
          runs: weekRuns.length,
        }
      })
  }, [runs, unit])

  // ── Recent runs (last 8) ──────────────────────────────────────────

  const recentRuns = useMemo(
    () =>
      [...runs]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 8),
    [runs],
  )

  // ── Render ────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      <KpiCards
        totalDist={totalDist}
        avgPace={avgPace}
        totalRuns={runs.length}
        totalTime={totalTime}
        unit={unit}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <VolumeChart data={monthlyBuckets} unit={unit} />
        <PaceChart data={paceData} unit={unit} />
      </div>

      <RecentRunsTable runs={recentRuns} unit={unit} />
    </div>
  )
}
