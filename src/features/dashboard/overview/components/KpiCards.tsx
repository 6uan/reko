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
}

export default function KpiCards({
  totalDist,
  avgPace,
  totalRuns,
  totalTime,
  unit,
  period,
}: Props) {
  const unitLabel = distanceUnit(unit)
  const paceLabel = paceUnit(unit)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
      <KpiCard
        label="Total Distance"
        value={toDisplayDistance(totalDist, unit)}
        unit={unitLabel}
        detail={`${totalRuns} run${totalRuns !== 1 ? 's' : ''}`}
      />
      <KpiCard
        label="Avg Pace"
        value={formatPace(avgPace)}
        unit={paceLabel}
        detail="All runs"
      />
      <KpiCard label="Total Runs" value={totalRuns} detail={period} />
      <KpiCard label="Total Time" value={formatDuration(totalTime)} detail={period} />
    </div>
  )
}
