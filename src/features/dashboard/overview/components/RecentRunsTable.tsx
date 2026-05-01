/**
 * Recent runs table — last 8 runs overall.
 */

import { formatPace, formatDuration } from '@/lib/strava'
import {
  toDisplayDistance,
  paceForUnit,
  type Activity,
  type Unit,
} from '@/lib/activities'
import Card from '@/features/dashboard/ui/Card'

type Props = {
  runs: Activity[]
  unit: Unit
}

export default function RecentRunsTable({ runs, unit }: Props) {
  const unitLabel = unit === 'mi' ? 'mi' : 'km'
  const paceLabel = unit === 'mi' ? '/mi' : '/km'

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-(--line)">
        <span className="text-eyebrow">Recent Runs</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-(--card-2) text-(--ink-4) text-left">
              <th className="px-4 py-2 font-medium">Activity</th>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium text-right">Distance</th>
              <th className="px-4 py-2 font-medium text-right">Time</th>
              <th className="px-4 py-2 font-medium text-right">Pace</th>
              <th className="px-4 py-2 font-medium text-right">Avg HR</th>
              <th className="px-4 py-2 font-medium text-right">Elev</th>
              <th className="px-4 py-2 font-medium text-center">PR</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr
                key={run.id}
                className="border-t border-(--line) hover:bg-(--bg-2) transition-colors"
              >
                <td className="px-4 py-2.5 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-(--accent) shrink-0" />
                  <span className="truncate max-w-45">{run.name}</span>
                </td>
                <td className="px-4 py-2.5 text-(--ink-3) whitespace-nowrap">
                  {new Date(run.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {toDisplayDistance(run.distanceMeters, unit)} {unitLabel}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {formatDuration(run.movingTime)}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {formatPace(paceForUnit(run.avgSpeed, unit))} {paceLabel}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {run.avgHr !== null ? run.avgHr : '—'}
                </td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                  {run.elevation > 0 ? `${Math.round(run.elevation)}m` : '—'}
                </td>
                <td className="px-4 py-2.5 text-center">
                  {run.prCount > 0 ? (
                    <span className="inline-block px-2 py-0.5 rounded-full bg-(--accent-soft) text-(--accent) text-[11px] font-medium">
                      {run.prCount} PR
                    </span>
                  ) : (
                    <span className="text-(--ink-4)">—</span>
                  )}
                </td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-(--ink-4)"
                >
                  No runs yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
