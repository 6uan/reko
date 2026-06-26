/**
 * Four KPI cards for the overview tab — summary stats for the selected period.
 */

import { formatPace, formatDuration } from '@/lib/strava'
import { toDisplayDistance, distanceUnit, paceUnit, type Unit } from '@/lib/activities'
import KpiCard from '@/features/dashboard/ui/KpiCard'

type Props = {
  totalDist: number
  avgPace: number
  totalRuns: number
  totalTime: number
  unit: Unit
  /** Label for the active time range, e.g. "All time" / "2024". */
  period: string
  /** Vertical stat-rail layout (beside the heatmap) instead of the 4-up grid. */
  stacked?: boolean
}

export default function KpiCards({
  totalDist,
  avgPace,
  totalRuns,
  totalTime,
  unit,
  period,
  stacked = false,
}: Props) {
  const unitLabel = distanceUnit(unit)
  const paceLabel = paceUnit(unit)
  const cardCls = stacked ? 'flex-1 flex flex-col justify-center' : undefined

  return (
    <div
      className={
        stacked
          ? 'flex flex-col gap-2.5 h-full'
          : 'grid grid-cols-2 lg:grid-cols-4 gap-2.5'
      }
    >
      <KpiCard
        className={cardCls}
        label="Total Distance"
        value={toDisplayDistance(totalDist, unit)}
        unit={unitLabel}
        detail={`${totalRuns} run${totalRuns !== 1 ? 's' : ''}`}
      />
      <KpiCard
        className={cardCls}
        label="Avg Pace"
        value={formatPace(avgPace)}
        unit={paceLabel}
        detail="All runs"
      />
      <KpiCard className={cardCls} label="Total Runs" value={totalRuns} detail={period} />
      <KpiCard
        className={cardCls}
        label="Total Time"
        value={formatDuration(totalTime)}
        detail={period}
      />
    </div>
  )
}
