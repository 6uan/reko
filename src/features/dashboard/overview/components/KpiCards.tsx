/**
 * Four KPI cards for the overview tab — summary stats for the selected period.
 */

import { formatPace, formatDuration } from '@/lib/strava'
import { toDisplayDistance, distanceUnit, paceUnit, type Unit } from '@/lib/activities'
import Card from '@/features/dashboard/ui/Card'
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

  // Compact stat rail beside the heatmap: one card, three stats, no redundant
  // "Total Runs" (the run count already rides under Total Distance).
  if (stacked) {
    return (
      <Card className="h-full p-4 flex flex-col justify-center divide-y divide-(--line)">
        <div className="pb-4">
          <Stat
            label="Total Distance"
            value={toDisplayDistance(totalDist, unit)}
            unit={unitLabel}
            detail={`${totalRuns} run${totalRuns !== 1 ? 's' : ''}`}
          />
        </div>
        <div className="py-4">
          <Stat label="Avg Pace" value={formatPace(avgPace)} unit={paceLabel} detail="All runs" />
        </div>
        <div className="pt-4">
          <Stat label="Total Time" value={formatDuration(totalTime)} detail={period} />
        </div>
      </Card>
    )
  }

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

/** One stat inside the stacked rail (label · big value · detail). */
function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string
  value: string | number
  unit?: string
  detail?: string
}) {
  return (
    <div>
      <div className="text-eyebrow">{label}</div>
      <div className="text-stat mt-1">
        {value}
        {unit && (
          <span className="text-sm text-(--ink-3) ml-0.5 font-normal">{unit}</span>
        )}
      </div>
      {detail && <div className="text-detail mt-1">{detail}</div>}
    </div>
  )
}
