import { useMemo } from 'react'
import {
  speedToPaceSeconds,
  formatPace,
  formatDistanceKm,
  formatDuration,
} from '../../lib/strava'

// ── Types ─────────────────────────────────────────────────────────

export type DashboardRun = {
  id: number
  name: string
  date: string
  distanceMeters: number
  movingTime: number
  avgSpeed: number
  avgHr: number | null
  maxHr: number | null
  cadence: number | null
  elevation: number
  prCount: number
}

type Props = {
  runs: DashboardRun[]
  unit: 'km' | 'mi'
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDistForUnit(meters: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') return (meters / 1609.344).toFixed(2)
  return formatDistanceKm(meters)
}

function paceForUnit(speedMs: number, unit: 'km' | 'mi'): number {
  const paceSec = speedToPaceSeconds(speedMs)
  return unit === 'mi' ? paceSec * 1.60934 : paceSec
}

// ── Distance milestones ─────────────────────────────────────────

const DISTANCE_MILESTONES = [
  { label: '1K', meters: 1000, tolerance: 200 },
  { label: '5K', meters: 5000, tolerance: 500 },
  { label: '10K', meters: 10000, tolerance: 1000 },
  { label: 'Half marathon', meters: 21097, tolerance: 2000 },
  { label: 'Marathon', meters: 42195, tolerance: 3000 },
] as const

// ── Component ─────────────────────────────────────────────────────

export default function Records({ runs, unit }: Props) {
  const unitLabel = unit === 'mi' ? '/mi' : '/km'

  // ── PR runs ────────────────────────────────────────────────────

  const prRuns = useMemo(
    () =>
      runs
        .filter((r) => r.prCount > 0)
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
    [runs],
  )

  const totalPrs = useMemo(
    () => prRuns.reduce((sum, r) => sum + r.prCount, 0),
    [prRuns],
  )

  // ── Best time at each distance milestone ──────────────────────

  const distanceRecords = useMemo(() => {
    return DISTANCE_MILESTONES.map((milestone) => {
      // Find runs that are at least the milestone distance
      const qualifying = runs.filter(
        (r) => r.distanceMeters >= milestone.meters - milestone.tolerance,
      )

      if (qualifying.length === 0) {
        return { ...milestone, bestRun: null, closestDist: 0 }
      }

      // Among qualifying runs, find the one with the best (fastest) pace
      const bestRun = qualifying.reduce((best, r) =>
        r.avgSpeed > best.avgSpeed ? r : best,
      )

      return { ...milestone, bestRun, closestDist: bestRun.distanceMeters }
    })
  }, [runs])

  // ── Best by distance range (more granular) ────────────────────

  const DISTANCE_RANGES = useMemo(() => {
    const ranges = [
      { label: '< 3K', min: 0, max: 3000 },
      { label: '3K – 5K', min: 3000, max: 5000 },
      { label: '5K – 10K', min: 5000, max: 10000 },
      { label: '10K – 15K', min: 10000, max: 15000 },
      { label: '15K – 21K', min: 15000, max: 21097 },
      { label: '21K+', min: 21097, max: Infinity },
    ]

    return ranges.map((range) => {
      const inRange = runs.filter(
        (r) => r.distanceMeters >= range.min && r.distanceMeters < range.max,
      )
      if (inRange.length === 0) return { ...range, bestRun: null, count: 0 }

      const bestRun = inRange.reduce((best, r) =>
        r.avgSpeed > best.avgSpeed ? r : best,
      )
      return { ...range, bestRun, count: inRange.length }
    })
  }, [runs])

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-[17px] font-semibold text-[var(--ink)] tracking-tight leading-tight">
          Personal records
        </h2>
        <p className="font-mono text-[11px] text-[var(--ink-4)] mt-0.5">
          {totalPrs} PR{totalPrs !== 1 ? 's' : ''} across{' '}
          {prRuns.length} activit{prRuns.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {/* Distance milestone cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {distanceRecords.map((record) => (
          <div
            key={record.label}
            className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-[18px] relative overflow-hidden"
          >
            <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--ink-3)]">
              {record.label}
            </div>
            <div className="font-mono text-[28px] font-medium tracking-tight tabular-nums mt-2 text-[var(--ink)]">
              {record.bestRun ? formatDuration(record.bestRun.movingTime) : '—'}
            </div>
            {record.bestRun && (
              <>
                <div className="font-mono text-[12px] text-[var(--ink-3)] mt-1">
                  {formatPace(paceForUnit(record.bestRun.avgSpeed, unit))}
                  <span className="ml-0.5">{unitLabel}</span>
                </div>
                <div className="flex justify-between font-mono text-[10px] text-[var(--ink-4)] mt-3 pt-2.5 border-t border-[var(--line-2)]">
                  <span className="truncate mr-2">{record.bestRun.name}</span>
                  <span className="whitespace-nowrap">{formatDate(record.bestRun.date)}</span>
                </div>
              </>
            )}
            {!record.bestRun && (
              <div className="font-mono text-[11px] text-[var(--ink-4)] mt-2">
                No runs at this distance
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Best pace by distance range */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)]">
          <h3 className="text-[15px] font-medium text-[var(--ink)]">
            Best pace by distance range
          </h3>
          <p className="font-mono text-[11px] text-[var(--ink-4)] mt-0.5">
            Fastest run in each distance bucket
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Distance range
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Best pace
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Time
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Distance
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Activity
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-right font-medium">
                  Runs
                </th>
              </tr>
            </thead>
            <tbody>
              {DISTANCE_RANGES.map((range) => (
                <tr key={range.label}>
                  <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-medium text-[var(--ink)]">
                    {range.label}
                  </td>
                  <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums">
                    {range.bestRun ? (
                      <span className="text-[var(--accent)] font-medium">
                        {formatPace(paceForUnit(range.bestRun.avgSpeed, unit))}
                        <span className="text-[var(--ink-3)] font-normal ml-0.5">{unitLabel}</span>
                      </span>
                    ) : (
                      <span className="text-[var(--ink-4)]">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink-3)]">
                    {range.bestRun ? formatDuration(range.bestRun.movingTime) : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink-3)]">
                    {range.bestRun
                      ? `${formatDistForUnit(range.bestRun.distanceMeters, unit)} ${unit}`
                      : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] text-[var(--ink-3)]">
                    {range.bestRun?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink-3)] text-right">
                    {range.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PR history table */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--line)]">
          <h3 className="text-[15px] font-medium text-[var(--ink)]">
            PR history
          </h3>
          <p className="font-mono text-[11px] text-[var(--ink-4)] mt-0.5">
            Activities with personal records
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Date
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Distance
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Time
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Pace
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Activity
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {prRuns.map((run) => {
                const pace = paceForUnit(run.avgSpeed, unit)
                const dist = formatDistForUnit(run.distanceMeters, unit)
                return (
                  <tr key={run.id}>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] text-[var(--ink-3)]">
                      {formatDate(run.date)}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {dist}
                      <span className="text-[var(--ink-3)] ml-0.5">{unit}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {formatDuration(run.movingTime)}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {formatPace(pace)}{unitLabel}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-medium text-[var(--ink)]">
                      {run.name}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink-3)]">
                      {run.prCount} PR{run.prCount !== 1 ? 's' : ''}
                      {run.avgHr != null && (
                        <span className="ml-1.5">
                          &middot; {Math.round(run.avgHr)} bpm
                        </span>
                      )}
                      {run.elevation > 0 && (
                        <span className="ml-1.5">
                          &middot; {Math.round(run.elevation)}m elev
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {prRuns.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-[13px] text-[var(--ink-3)]"
                  >
                    No personal records yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
