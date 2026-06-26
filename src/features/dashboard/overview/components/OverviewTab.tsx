import { useMemo } from 'react'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import { monthWindow, periodLabel } from '@/features/dashboard/range'
import { groupByWeek } from '@/lib/aggregations'
import { HR_ZONES, zoneFor } from '@/lib/heartRate'
import {
  KM_PER_MI,
  paceForUnit,
  avg,
  type Activity,
  type Unit,
} from '@/lib/activities'
import KpiCards from './KpiCards'
import TrainingHeatmap from './TrainingHeatmap'
import ZoneRingCard from './ZoneRingCard'
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
  const { range, allRuns } = useDashboard()

  // ── KPI data (scoped to selected range) ───────────────────────────

  const totalDist = useMemo(
    () => runs.reduce((s, r) => s + r.distanceMeters, 0),
    [runs],
  )

  const avgPace = useMemo(() => {
    const valid = runs.filter((r) => r.avgSpeed > 0)
    if (!valid.length) return 0
    return avg(valid.map((r) => paceForUnit(r.avgSpeed, unit)))
  }, [runs, unit])

  const avgHr = useMemo(() => {
    const v = runs.map((r) => r.avgHr).filter((h): h is number => h != null)
    return v.length ? Math.round(avg(v)) : null
  }, [runs])

  const avgCadence = useMemo(() => {
    const v = runs.map((r) => r.cadence).filter((c): c is number => c != null)
    return v.length ? Math.round(avg(v)) : null
  }, [runs])

  // Time-in-zone (approx): attribute each run's moving time to its avg-HR zone.
  const zoneSeconds = useMemo(() => {
    const totals = HR_ZONES.map(() => 0)
    for (const r of runs) {
      if (r.avgHr == null) continue
      totals[HR_ZONES.indexOf(zoneFor(r.avgHr))] += r.movingTime
    }
    return totals
  }, [runs])

  const totalTime = useMemo(
    () => runs.reduce((s, r) => s + r.movingTime, 0),
    [runs],
  )

  // ── Volume chart data (months within the selected range) ─────────

  const monthlyBuckets = useMemo<MonthBucket[]>(() => {
    if (!runs.length) return []

    const sorted = [...runs].sort((a, b) => a.date.localeCompare(b.date))
    const first = new Date(sorted[0].date)
    const { start, end } = monthWindow(range, first)

    const buckets: MonthBucket[] = []
    const d = new Date(start)

    while (d <= end) {
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
  }, [runs, unit, range])

  // ── Pace chart data (all weeks with data) ─────────────────────────

  const paceData = useMemo<PacePoint[]>(
    () =>
      // Same Monday-bucketed weekly average as PaceTab's trend — shared via
      // groupByWeek so the two pace charts can't drift (it also skips
      // zero/negative paces). fullLabel (the tooltip's date range) is derived
      // from the bucket's Monday so it stays in sync with the short label.
      groupByWeek(runs, (r) => r.date, (r) => paceForUnit(r.avgSpeed, unit)).map(
        (b) => {
          const mon = new Date(b.week)
          const sun = new Date(mon)
          sun.setDate(sun.getDate() + 6)
          return {
            label: b.label,
            fullLabel: `${MONTH_NAMES_SHORT[mon.getMonth()]} ${mon.getDate()} – ${MONTH_NAMES_SHORT[sun.getMonth()]} ${sun.getDate()}`,
            pace: b.avg,
            runs: b.count,
          }
        },
      ),
    [runs, unit],
  )

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
      <div className="flex flex-col lg:flex-row gap-4 lg:items-stretch">
        <div className="min-w-0 overflow-x-auto">
          <TrainingHeatmap runs={allRuns} unit={unit} />
        </div>
        <div className="lg:w-44 lg:shrink-0">
          <ZoneRingCard zoneSeconds={zoneSeconds} avgHr={avgHr} />
        </div>
        <div className="lg:w-52 lg:shrink-0">
          <KpiCards
            stacked
            totalDist={totalDist}
            avgPace={avgPace}
            totalRuns={runs.length}
            totalTime={totalTime}
            avgCadence={avgCadence}
            unit={unit}
            period={periodLabel(range)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        <VolumeChart data={monthlyBuckets} unit={unit} />
        <PaceChart data={paceData} unit={unit} />
      </div>

      <RecentRunsTable runs={recentRuns} unit={unit} />
    </div>
  )
}
