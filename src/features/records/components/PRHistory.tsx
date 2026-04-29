/**
 * Flat PR history table — all distances with a PR, sorted by most
 * recent date, showing time + pace + improvement vs previous best.
 */

import { formatDuration } from '../../../lib/strava'
import type { Unit } from '../../../lib/activities'
import type { DistanceRecord } from '../distances'
import { parseLocalDate, formatDate, paceForDist, formatPace } from './helpers'
import { Th, Td } from './TablePrimitives'

type Props = {
  distances: DistanceRecord[]
  unit: Unit
}

export default function PRHistory({ distances, unit }: Props) {
  const unitLabel = unit === 'km' ? '/km' : '/mi'
  const rows = distances
    .filter((d) => d.best)
    .sort(
      (a, b) =>
        parseLocalDate(b.best!.startDateLocal).getTime() -
        parseLocalDate(a.best!.startDateLocal).getTime(),
    )

  if (rows.length === 0) {
    return (
      <div className="p-10 text-center font-mono text-[12px] text-(--ink-3)">
        No personal records yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-180">
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Distance</Th>
            <Th>Time</Th>
            <Th>Pace</Th>
            <Th>Activity</Th>
            <Th>Previous</Th>
            <Th>Improvement</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const best = r.best!
            const prev = r.runnerUp?.elapsedTime ?? null
            const pace = paceForDist(best.elapsedTime, r.meters, unit)
            const delta = prev !== null ? prev - best.elapsedTime : 0
            const pct = prev !== null && prev > 0 ? (delta / prev) * 100 : 0
            return (
              <tr key={r.key}>
                <Td className="font-mono text-[11px] text-(--ink-3) tabular-nums">
                  {formatDate(best.startDateLocal)}
                </Td>
                <Td className="text-(--ink) font-medium">{r.label}</Td>
                <Td className="font-mono tabular-nums text-(--ink)">
                  {formatDuration(best.elapsedTime)}
                </Td>
                <Td className="font-mono tabular-nums text-(--ink)">
                  {formatPace(pace)}
                  <span className="text-(--ink-3) ml-0.5">{unitLabel}</span>
                </Td>
                <Td>
                  <a
                    href={`https://www.strava.com/activities/${best.activityId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--ink-2) no-underline hover:text-(--accent)"
                  >
                    {best.activityName}
                  </a>
                </Td>
                <Td className="font-mono tabular-nums text-(--ink-3)">
                  {prev !== null ? formatDuration(prev) : '—'}
                </Td>
                <Td className="font-mono tabular-nums text-(--accent)">
                  {prev !== null
                    ? `−${formatDuration(delta)} · ${pct.toFixed(1)}%`
                    : '—'}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
