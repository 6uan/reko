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
  /** Avg HR / cadence across the runs — shown in the stacked rail only. */
  avgHr?: number | null
  avgCadence?: number | null
}

export default function KpiCards({
  totalDist,
  avgPace,
  totalRuns,
  totalTime,
  unit,
  period,
  stacked = false,
  avgHr = null,
  avgCadence = null,
}: Props) {
  const unitLabel = distanceUnit(unit)
  const paceLabel = paceUnit(unit)

  // Compact stat rail beside the heatmap: one card, three stats, no redundant
  // "Total Runs" (the run count already rides under Total Distance).
  if (stacked) {
    return (
      <Card className="h-full p-4 flex flex-col justify-center">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
          <Stat
            label="Total Distance"
            value={toDisplayDistance(totalDist, unit)}
            unit={unitLabel}
            detail={`${totalRuns} run${totalRuns !== 1 ? 's' : ''}`}
          />
          <Stat label="Avg Pace" value={formatPace(avgPace)} unit={paceLabel} />
          <Stat
            label="Avg HR"
            value={avgHr ?? '—'}
            unit={avgHr != null ? 'bpm' : undefined}
          />
          <Stat
            label="Avg Cadence"
            value={avgCadence ?? '—'}
            unit={avgCadence != null ? 'spm' : undefined}
          />
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
    <div className="min-w-0">
      <div className="text-eyebrow">{label}</div>
      <div className="mt-1 truncate text-2xl font-semibold tabular-nums text-(--ink)">
        {value}
        {unit && (
          <span className="ml-0.5 text-xs font-normal text-(--ink-3)">{unit}</span>
        )}
      </div>
      {detail && <div className="text-detail mt-0.5">{detail}</div>}
    </div>
  )
}
