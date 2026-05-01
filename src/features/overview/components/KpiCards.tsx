/**
 * Four KPI cards for the overview tab — the numbers a runner checks first:
 *   1. This Week distance (vs last week)
 *   2. Avg Pace this month (vs last month)
 *   3. This Month distance (vs last month)
 *   4. This Month total time
 */

import { formatPace, formatDuration } from '../../../lib/strava'
import { toDisplayDistance, type Unit } from '../../../lib/activities'
import { pctChange } from '../helpers'

type Props = {
  thisWeekDist: number
  lastWeekDist: number
  avgPaceThis: number
  avgPaceLast: number
  thisMonthDist: number
  lastMonthDist: number
  thisMonthRunCount: number
  thisMonthTime: number
  lastMonthTime: number
  unit: Unit
}

export default function KpiCards({
  thisWeekDist,
  lastWeekDist,
  avgPaceThis,
  avgPaceLast,
  thisMonthDist,
  lastMonthDist,
  thisMonthRunCount,
  thisMonthTime,
  lastMonthTime,
  unit,
}: Props) {
  const unitLabel = unit === 'mi' ? 'mi' : 'km'
  const paceLabel = unit === 'mi' ? '/mi' : '/km'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* This Week */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
          This Week
        </span>
        <div className="mt-2 font-mono text-[26px] font-medium tracking-tight tabular-nums text-(--ink)">
          {toDisplayDistance(thisWeekDist, unit)}{' '}
          <span className="text-[14px] text-(--ink-3)">{unitLabel}</span>
        </div>
        <span className="text-[12px] text-(--ink-3)">
          {pctChange(thisWeekDist, lastWeekDist)} vs last week
        </span>
      </div>

      {/* Avg Pace */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
          Avg Pace
        </span>
        <div className="mt-2 font-mono text-[26px] font-medium tracking-tight tabular-nums text-(--ink)">
          {formatPace(avgPaceThis)}{' '}
          <span className="text-[14px] text-(--ink-3)">{paceLabel}</span>
        </div>
        <span className="text-[12px] text-(--ink-3)">
          {avgPaceLast > 0
            ? pctChange(avgPaceThis, avgPaceLast) + ' vs last month'
            : 'no data last month'}
        </span>
      </div>

      {/* Monthly Distance */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
          This Month
        </span>
        <div className="mt-2 font-mono text-[26px] font-medium tracking-tight tabular-nums text-(--ink)">
          {toDisplayDistance(thisMonthDist, unit)}{' '}
          <span className="text-[14px] text-(--ink-3)">{unitLabel}</span>
        </div>
        <span className="text-[12px] text-(--ink-3)">
          {pctChange(thisMonthDist, lastMonthDist)} vs last month
          {' · '}
          {thisMonthRunCount} run{thisMonthRunCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Total Time */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
          Time This Month
        </span>
        <div className="mt-2 font-mono text-[26px] font-medium tracking-tight tabular-nums text-(--ink)">
          {formatDuration(thisMonthTime)}
        </div>
        <span className="text-[12px] text-(--ink-3)">
          {lastMonthTime > 0
            ? pctChange(thisMonthTime, lastMonthTime) + ' vs last month'
            : 'no data last month'}
        </span>
      </div>
    </div>
  )
}
