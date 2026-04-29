/**
 * Best pace by distance range — table with 6 buckets.
 *
 * Activity counts per bucket come from the dashboard's full run list
 * (not best_efforts) since 10K–15K runs exist even though there's
 * no canonical best-effort distance for that range.
 */

import { useMemo } from 'react'
import { formatDuration } from '../../../lib/strava'
import type { DashboardRun, Unit } from '../../../lib/activities'
import type { DistanceRecord } from '../distances'
import { paceForDist, formatPace } from './helpers'
import { Th, Td } from './TablePrimitives'

const PACE_BUCKETS = [
  { key: '<3K', min: 0, max: 3000, distKey: '1k' as const },
  { key: '3K–5K', min: 3000, max: 5000, distKey: '5k' as const },
  { key: '5K–10K', min: 5000, max: 10000, distKey: '10k' as const },
  // No canonical Strava effort fits this range — empty by design.
  { key: '10K–15K', min: 10000, max: 15000, distKey: null },
  { key: '15K–21K', min: 15000, max: 21097, distKey: 'half' as const },
  { key: '21K+', min: 21097, max: Infinity, distKey: 'mar' as const },
] as const

type Props = {
  distances: DistanceRecord[]
  runs: DashboardRun[]
  unit: Unit
}

export default function PaceByRange({ distances, runs, unit }: Props) {
  const unitLabel = unit === 'km' ? '/km' : '/mi'
  const distMap = useMemo(() => {
    const m = new Map<string, DistanceRecord>()
    for (const d of distances) m.set(d.key, d)
    return m
  }, [distances])

  const counts = useMemo(() => {
    const c = PACE_BUCKETS.map(() => 0)
    for (const r of runs) {
      const m = r.distanceMeters
      const idx = PACE_BUCKETS.findIndex((b) => m >= b.min && m < b.max)
      if (idx !== -1) c[idx]++
    }
    return c
  }, [runs])

  const rowsData = PACE_BUCKETS.map((b) => {
    const dist = b.distKey ? (distMap.get(b.distKey) ?? null) : null
    const best = dist?.best ?? null
    if (!best) return { bucket: b, pace: null, dist, best }
    const pace = paceForDist(best.elapsedTime, dist!.meters, unit)
    return { bucket: b, pace, dist, best }
  })

  const allPaces = rowsData
    .map((r) => r.pace)
    .filter((p): p is number => p !== null)
  const fastest = allPaces.length ? Math.min(...allPaces) : null
  const slowest = allPaces.length ? Math.max(...allPaces) : null
  const range =
    fastest !== null && slowest !== null && slowest - fastest > 0
      ? slowest - fastest
      : 1

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-160">
        <thead>
          <tr>
            <Th>Distance range</Th>
            <Th>Best pace</Th>
            <Th />
            <Th>Time</Th>
            <Th>Activity</Th>
            <Th align="right">Runs</Th>
          </tr>
        </thead>
        <tbody>
          {rowsData.map((row, idx) => {
            const { bucket, pace, dist, best } = row
            if (!pace || !best || !dist) {
              return (
                <tr key={bucket.key}>
                  <Td className="text-(--ink) font-medium">
                    {bucket.key}
                  </Td>
                  <Td className="text-(--ink-4)">—</Td>
                  <Td />
                  <Td className="text-(--ink-4)">—</Td>
                  <Td className="text-(--ink-4)">—</Td>
                  <Td align="right" className="text-(--ink-4) tabular-nums">
                    {counts[idx]}
                  </Td>
                </tr>
              )
            }
            const isFastest = pace === fastest
            const fillPct =
              fastest !== null ? 100 * (1 - (pace - fastest) / range) : 0
            return (
              <tr key={bucket.key}>
                <Td className="text-(--ink) font-medium">{bucket.key}</Td>
                <Td className="font-mono tabular-nums">
                  <span
                    className={
                      isFastest
                        ? 'text-(--accent) font-medium'
                        : 'text-(--ink-2)'
                    }
                  >
                    {formatPace(pace)}
                  </span>
                  <span className="text-(--ink-4) ml-1">{unitLabel}</span>
                </Td>
                <Td>
                  <div className="inline-flex items-center min-w-30">
                    <div className="h-1 rounded-sm bg-(--line-2) flex-1 overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${fillPct}%`,
                          background: isFastest
                            ? 'var(--accent)'
                            : 'var(--ink-3)',
                        }}
                      />
                    </div>
                  </div>
                </Td>
                <Td className="font-mono tabular-nums text-(--ink-2)">
                  {formatDuration(best.elapsedTime)}
                </Td>
                <Td className="text-(--ink-3) truncate max-w-50">
                  <a
                    href={`https://www.strava.com/activities/${best.activityId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-(--ink-2) no-underline hover:text-(--accent)"
                  >
                    {best.activityName}
                  </a>
                </Td>
                <Td align="right" className="font-mono tabular-nums text-(--ink-3)">
                  {counts[idx]}
                </Td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
