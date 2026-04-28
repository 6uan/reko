/**
 * Personal Records tab.
 *
 * Reads pre-aggregated `RecordsData` from the dashboard loader (sourced
 * from `best_efforts` joined to `activities`) and renders:
 *
 *   1. Hero PR — the most-recently-set PR across all canonical distances.
 *      Left half: distance + big time + pace. Right half: improvement
 *      vs previous best + runner-up.
 *   2. Per-distance list — each non-hero distance as a collapsible row.
 *      Closed: dist + time + pace + when. Open: activity link, runner-up,
 *      third best, and a chronological sparkline of all-time PR walks.
 *   3. Three accordions: progression chart, best pace by distance range,
 *      flat PR history table.
 *
 * Disclosures use the native `<details>` element — works without any
 * client state, the chevron is rotated via the `[open]` attribute. The
 * `runs` prop (full activities list) drives the bucket counts in the
 * pace-by-range table since `best_efforts` only covers six canonical
 * distances and the table buckets include 10K-15K (no canonical fit).
 */

import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDuration } from '../../lib/strava'
import {
  DISTANCE_DEFS,
  type RecordsData,
  type DistanceRecord,
  type RecordEffort,
} from './distances'

import { KM_PER_MI, type DashboardRun, type Unit } from '../../lib/activities'

type Props = {
  data: RecordsData
  runs: DashboardRun[]
  unit: Unit
}

// ── Format helpers ────────────────────────────────────────────────

/**
 * Wall-clock string ("YYYY-MM-DD HH:MM:SS") → Date. We append `Z` so
 * Date.parse interprets the wall-clock as UTC — matches what the
 * dashboard loader does for activities, keeping Mar 12 → Mar 12 across
 * server (UTC) and browser (local).
 */
function parseLocalDate(s: string): Date {
  return new Date(s.replace(' ', 'T') + 'Z')
}

function formatDate(s: string): string {
  return parseLocalDate(s).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function relTime(s: string, now: Date): string {
  const days = Math.floor(
    (now.getTime() - parseLocalDate(s).getTime()) / 86400000,
  )
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const y = Math.floor(days / 365)
  return `${y} year${y > 1 ? 's' : ''} ago`
}

function paceForDist(seconds: number, meters: number, unit: Unit) {
  const dist = unit === 'km' ? meters / 1000 : meters / KM_PER_MI
  return seconds / dist
}

function formatPace(paceSec: number): string {
  if (!Number.isFinite(paceSec) || paceSec <= 0) return '—'
  const m = Math.floor(paceSec / 60)
  const s = Math.round(paceSec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function isRecent(s: string, now: Date, days: number): boolean {
  return (now.getTime() - parseLocalDate(s).getTime()) / 86400000 < days
}

// ── Sparkline ─────────────────────────────────────────────────────

function Sparkline({
  trend,
  recent,
}: {
  trend: { date: string; time: number }[]
  recent: boolean
}) {
  if (trend.length < 2) return null
  const W = 80
  const H = 26
  const times = trend.map((p) => p.time)
  const mn = Math.min(...times)
  const mx = Math.max(...times)
  const range = mx - mn || 1
  const pts = trend.map((v, i) => [
    (i / (trend.length - 1)) * W,
    H - ((v.time - mn) / range) * H + 1,
  ])
  const pathD = pts
    .map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1))
    .join(' ')
  const stroke = recent ? 'var(--accent)' : 'var(--ink-3)'
  const fillOpacity = recent ? 0.18 : 0.08
  const last = pts[pts.length - 1]
  return (
    <svg width={W} height={H + 2} viewBox={`0 0 ${W} ${H + 2}`}>
      <path
        d={`${pathD} L${W},${H + 2} L0,${H + 2} Z`}
        fill="var(--accent)"
        fillOpacity={fillOpacity}
      />
      <path
        d={pathD}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.2} fill={stroke} />
    </svg>
  )
}

// ── Distance row (collapsible) ────────────────────────────────────

function DistanceRow({
  rec,
  unit,
  now,
}: {
  rec: DistanceRecord
  unit: Unit
  now: Date
}) {
  const unitLabel = unit === 'km' ? '/km' : '/mi'

  if (!rec.best) {
    return (
      <div className="grid grid-cols-[110px_1fr_auto_24px] items-center gap-4 px-5 py-4 border-b border-(--line) last:border-b-0">
        <span className="font-mono text-[11px] uppercase tracking-widest text-(--ink-3)">
          {rec.label}
        </span>
        <span className="font-mono text-[14px] text-(--ink-4)">
          no PR yet
        </span>
        <span className="font-mono text-[11px] text-(--ink-4)] text-right whitespace-nowrap">
          awaiting first effort
        </span>
        <span />
      </div>
    )
  }

  const pace = paceForDist(rec.best.elapsedTime, rec.meters, unit)
  const recent = isRecent(rec.best.startDateLocal, now, 30)

  return (
    <details className="group border-b border-(--line) last:border-b-0 [[open]]:bg-(--card-2)">
      <summary className="grid grid-cols-[110px_1fr_auto_24px] items-center gap-4 px-5 py-4 cursor-pointer list-none hover:bg-(--card-2) transition-colors [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[11px] uppercase tracking-widest text-(--ink-3)">
          {rec.label}
        </span>
        {/* Time + pace stacked. Pace explicitly carries the /mi or /km
            suffix so the unit toggle isn't ambiguous, and a 'pace' word
            reinforces what the second number means at a glance. */}
        <div className="flex items-baseline gap-3 flex-wrap min-w-0">
          <span className="font-mono text-[18px] font-medium tabular-nums text-(--ink) tracking-tight">
            {formatDuration(rec.best.elapsedTime)}
          </span>
          <span className="font-mono text-[12px] tabular-nums text-(--ink-3) whitespace-nowrap">
            {formatPace(pace)}
            <span className="text-(--ink-2) font-medium ml-0.5">
              {unitLabel}
            </span>
            <span className="text-(--ink-4) ml-1.5">pace</span>
          </span>
        </div>
        <span className="font-mono text-[11px] text-(--ink-4)] text-right whitespace-nowrap">
          {relTime(rec.best.startDateLocal, now)}
        </span>
        <ChevronRight
          size={14}
          className="text-(--ink-3) transition-transform duration-150 group-open:rotate-90 justify-self-end"
        />
      </summary>

      {/* Expanded body */}
      <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 border-t border-(--line)">
        {/* Left: PR detail */}
        <div className="flex flex-col gap-3 pt-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
              Set on
            </div>
            <div className="font-mono text-[13px] text-(--ink-2) mt-1">
              {formatDate(rec.best.startDateLocal)}
            </div>
            <a
              href={`https://www.strava.com/activities/${rec.best.activityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-(--ink-3) hover:text-(--accent) no-underline mt-1 inline-block"
            >
              {rec.best.activityName} ↗
            </a>
          </div>

          {rec.runnerUp && (
            <RunnerRow
              label="Runner-up"
              effort={rec.runnerUp}
              now={now}
              cls="text-[var(--ink-3)]"
            />
          )}
          {rec.thirdBest && (
            <RunnerRow
              label="3rd best"
              effort={rec.thirdBest}
              now={now}
              cls="text-[var(--ink-4)]"
            />
          )}
        </div>

        {/* Right: progression sparkline + improvement summary */}
        <div className="flex flex-col gap-3 pt-4 md:border-l md:border-(--line) md:pl-5">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Progression · {rec.trend.length} PR{rec.trend.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-end gap-3">
            <Sparkline trend={rec.trend} recent={recent} />
            {rec.runnerUp && (
              <div className="font-mono text-[11px] text-(--ink-3) tabular-nums">
                <span className="text-(--accent)">
                  −{formatDuration(rec.runnerUp.elapsedTime - rec.best.elapsedTime)}
                </span>
                <span className="text-(--ink-4) ml-1">
                  vs prev
                </span>
              </div>
            )}
          </div>
          {rec.trend.length === 1 && (
            <div className="font-mono text-[11px] text-(--ink-4)">
              First effort at this distance — set the bar.
            </div>
          )}
        </div>
      </div>
    </details>
  )
}

function RunnerRow({
  label,
  effort,
  now,
  cls,
}: {
  label: string
  effort: RecordEffort
  now: Date
  cls: string
}) {
  return (
    <div className={`flex items-baseline justify-between gap-3 ${cls}`}>
      <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
        {label}
      </span>
      <span className="font-mono text-[13px] tabular-nums">
        {formatDuration(effort.elapsedTime)}
        <span className="text-(--ink-4) ml-2">
          {relTime(effort.startDateLocal, now)}
        </span>
      </span>
    </div>
  )
}

// ── Hero PR card ──────────────────────────────────────────────────

function HeroPR({
  rec,
  unit,
  now,
}: {
  rec: DistanceRecord
  unit: Unit
  now: Date
}) {
  if (!rec.best) return null
  const unitLabel = unit === 'km' ? '/km' : '/mi'
  const pace = paceForDist(rec.best.elapsedTime, rec.meters, unit)
  const prev = rec.runnerUp?.elapsedTime ?? null
  const delta = prev !== null ? prev - rec.best.elapsedTime : 0
  const pct = prev !== null && prev > 0 ? (delta / prev) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] bg-(--card) border border-(--line) rounded-2xl overflow-hidden">
      {/* Left: distance + big time */}
      <div className="px-9 py-8 flex flex-col justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-(--accent)">
            <span className="relative inline-block w-1.75 h-1.75 rounded-full bg-(--accent)">
              <span className="absolute -inset-0.75 rounded-full border-[1.5px] border-(--accent) opacity-0 animate-[pulse-ring_2s_ease-out_infinite]" />
            </span>
            Latest PR · {relTime(rec.best.startDateLocal, now)}
          </span>
          <div className="mt-3.5 text-[18px] font-medium text-(--ink-2) tracking-tight">
            {rec.label}
          </div>
          <div className="mt-1.5 font-mono text-[64px] md:text-[76px] font-medium tabular-nums tracking-[-0.035em] text-(--ink) leading-none">
            {formatDuration(rec.best.elapsedTime)}
          </div>
          <div className="mt-3 font-mono text-[14px] tabular-nums text-(--ink-3)">
            {formatPace(pace)} {unitLabel}
          </div>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px]">
          <span className="text-(--ink-2)">
            {formatDate(rec.best.startDateLocal)}
          </span>
          <a
            href={`https://www.strava.com/activities/${rec.best.activityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-(--ink-3) hover:text-(--accent) no-underline"
          >
            {rec.best.activityName} ↗
          </a>
        </div>
      </div>

      {/* Right: improvement breakdown */}
      <div className="px-9 py-8 border-t md:border-t-0 md:border-l border-(--line) bg-(--card-2)">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-(--ink-4) mb-4 font-medium">
          Improvement
        </h4>
        {prev !== null ? (
          <>
            <div className="flex items-baseline gap-2.5 mb-6">
              <span className="font-mono text-[28px] font-medium text-(--accent) tabular-nums tracking-[-0.02em]">
                −{formatDuration(delta)}
              </span>
              <span className="font-mono text-[13px] text-(--ink-3)">
                {pct.toFixed(1)}% faster
              </span>
            </div>
            <div className="flex justify-between items-baseline py-2.5 border-t border-(--line) font-mono text-[12px]">
              <span className="text-(--ink-4) uppercase text-[10px] tracking-widest">
                Previous best
              </span>
              <span className="text-(--ink-2) tabular-nums">
                {formatDuration(prev)}
              </span>
            </div>
            {rec.thirdBest && (
              <div className="flex justify-between items-baseline py-2.5 border-t border-(--line) font-mono text-[12px]">
                <span className="text-(--ink-4) uppercase text-[10px] tracking-widest">
                  3rd best
                </span>
                <span className="text-(--ink-2) tabular-nums">
                  {formatDuration(rec.thirdBest.elapsedTime)} ·{' '}
                  {relTime(rec.thirdBest.startDateLocal, now)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="font-mono text-[12px] text-(--ink-3)] leading-relaxed">
            First effort at this distance. Run it again and we'll track
            your improvement here.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Disclosure (accordion) ─────────────────────────────────────────

function Disclosure({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: React.ReactNode
}) {
  return (
    <details className="group bg-(--card) border border-(--line) rounded-2xl overflow-hidden [[open]]:border-[rgba(252,76,2,0.18)] transition-colors">
      <summary className="flex justify-between items-center px-5 py-4 cursor-pointer list-none hover:bg-(--card-2) transition-colors [&::-webkit-details-marker]:hidden">
        <span className="text-[14px] font-medium text-(--ink) tracking-tight">
          {title}
        </span>
        <span className="flex items-center gap-3 font-mono text-[11px] text-(--ink-4)">
          {meta}
          <ChevronRight
            size={12}
            className="text-(--ink-3) transition-transform duration-150 group-open:rotate-90"
          />
        </span>
      </summary>
      <div className="border-t border-(--line)">{children}</div>
    </details>
  )
}

// ── Progression chart ──────────────────────────────────────────────
//
// Multi-distance line chart. Y axis is "% slower than the all-time
// best" (per-distance), so different distances share the same scale —
// the top of the chart is "PR" and the bottom is "slowest tracked
// effort" for the slowest distance.

const DISTANCE_COLORS: Record<string, string> = {
  '1k': '#6ac6dc',
  '1mi': '#7dce72',
  '5k': 'var(--accent)',
  '10k': '#f3c64a',
  half: '#c39ddc',
  mar: '#ef8944',
}

function ProgressionChart({ distances }: { distances: DistanceRecord[] }) {
  // Pivot to one row per (sorted) timestamp, columns keyed by distance.
  // Value is "% above the all-time best for that distance" — lets every
  // distance share one Y scale (0 = current PR, larger = slower attempts
  // that were the running-best at the time but have since been beaten).
  // Recharts' `connectNulls` bridges gaps where a distance has no PR
  // event on a given date.
  const { chartData, bestByKey, withTrend } = useMemo(() => {
    const filtered = distances.filter((d) => d.trend.length > 0)
    const dateMap = new Map<number, Record<string, number> & { ts: number }>()
    const bests = new Map<string, number>()
    for (const d of filtered) {
      const best = Math.min(...d.trend.map((p) => p.time))
      bests.set(d.key, best)
      for (const point of d.trend) {
        const ts = parseLocalDate(point.date).getTime()
        const pct = (point.time / best - 1) * 100
        const row = dateMap.get(ts) ?? ({ ts } as Record<string, number> & { ts: number })
        row[d.key] = pct
        dateMap.set(ts, row)
      }
    }
    return {
      chartData: [...dateMap.values()].sort((a, b) => a.ts - b.ts),
      bestByKey: bests,
      withTrend: filtered,
    }
  }, [distances])

  if (withTrend.length === 0) {
    return (
      <div className="p-10 text-center font-mono text-[12px] text-(--ink-3)]">
        No PR history yet — keep running and the chart will fill in.
      </div>
    )
  }

  const labelByKey = Object.fromEntries(
    withTrend.map((d) => [d.key, d.label]),
  ) as Record<string, string>

  // Recharts feeds the active row to `payload[i].payload`. We render one
  // line per series the cursor is hovering over, with absolute time
  // recovered from `best * (1 + pct/100)` so the user sees their
  // wall-clock PR time, not just a percentage.
  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipContentProps) => {
    if (!active || !payload || payload.length === 0 || label == null) return null
    const date = new Date(Number(label)).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    return (
      <div className="bg-(--card) border border-(--line) rounded-lg shadow-md px-3 py-2 font-mono text-[11px] min-w-45">
        <div className="text-(--ink-3) mb-1.5">{date}</div>
        <div className="flex flex-col gap-1">
          {payload.map((p) => {
            const k = String(p.dataKey ?? '')
            const best = bestByKey.get(k)
            const pct = typeof p.value === 'number' ? p.value : 0
            const absTime = best !== undefined ? best * (1 + pct / 100) : null
            return (
              <div key={k} className="flex items-center gap-2">
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ background: p.color }}
                />
                <span className="text-(--ink-2)">{labelByKey[k]}</span>
                <span className="text-(--ink) tabular-nums ml-auto">
                  {absTime !== null ? formatDuration(absTime) : '—'}
                </span>
                <span className="text-(--ink-4) tabular-nums">
                  {pct < 0.05 ? 'PR' : `+${pct.toFixed(1)}%`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[14px] font-medium text-(--ink)">
          PR progression
        </h4>
        <span className="font-mono text-[11px] text-(--ink-3)">
          % above all-time best per distance
        </span>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 8, right: 16, bottom: 8, left: 4 }}
          >
            <CartesianGrid
              stroke="var(--line-2)"
              strokeDasharray="2 4"
              vertical={false}
            />
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              scale="time"
              tickFormatter={(t: number) => {
                const d = new Date(t)
                return `${d.toLocaleDateString('en', {
                  month: 'short',
                })} '${String(d.getFullYear()).slice(2)}`
              }}
              stroke="var(--line)"
              tickLine={false}
              tick={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fill: 'var(--ink-4)',
              }}
              minTickGap={48}
            />
            <YAxis
              tickFormatter={(v: number) =>
                v < 0.05 ? 'PR' : `+${v.toFixed(0)}%`
              }
              stroke="var(--line)"
              tickLine={false}
              reversed
              tick={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fill: 'var(--ink-4)',
              }}
              width={42}
            />
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: 'var(--line)', strokeDasharray: '2 4' }}
            />
            {withTrend.map((d) => (
              <Line
                key={d.key}
                type="monotone"
                dataKey={d.key}
                name={d.label}
                stroke={DISTANCE_COLORS[d.key] ?? 'var(--ink-3)'}
                strokeWidth={1.8}
                dot={{
                  r: 3,
                  fill: 'var(--card)',
                  strokeWidth: 1.8,
                  stroke: DISTANCE_COLORS[d.key] ?? 'var(--ink-3)',
                }}
                activeDot={{ r: 5 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex gap-3.5 flex-wrap font-mono text-[11px] text-(--ink-3) mt-3">
        {withTrend.map((d) => (
          <span
            key={d.key}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md"
          >
            <span
              className="inline-block w-2.5 h-0.5 rounded-sm"
              style={{ background: DISTANCE_COLORS[d.key] ?? 'var(--ink-3)' }}
            />
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Best pace by distance range ──────────────────────────────────

const PACE_BUCKETS = [
  { key: '<3K', min: 0, max: 3000, distKey: '1k' as const },
  { key: '3K–5K', min: 3000, max: 5000, distKey: '5k' as const },
  { key: '5K–10K', min: 5000, max: 10000, distKey: '10k' as const },
  // No canonical Strava effort fits this range — empty by design.
  { key: '10K–15K', min: 10000, max: 15000, distKey: null },
  { key: '15K–21K', min: 15000, max: 21097, distKey: 'half' as const },
  { key: '21K+', min: 21097, max: Infinity, distKey: 'mar' as const },
] as const

function PaceByRange({
  distances,
  runs,
  unit,
}: {
  distances: DistanceRecord[]
  runs: DashboardRun[]
  unit: Unit
}) {
  const unitLabel = unit === 'km' ? '/km' : '/mi'
  const distMap = useMemo(() => {
    const m = new Map<string, DistanceRecord>()
    for (const d of distances) m.set(d.key, d)
    return m
  }, [distances])

  // Activity counts per bucket — drawn from the dashboard's run list
  // (full activities) rather than best_efforts, since 10K-15K runs
  // exist even though they have no canonical best-effort distance.
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

// ── PR history (flat table) ────────────────────────────────────────

function PRHistory({
  distances,
  unit,
}: {
  distances: DistanceRecord[]
  unit: Unit
}) {
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

// ── Tiny table helpers ─────────────────────────────────────────────

function Th({
  children,
  align,
}: {
  children?: React.ReactNode
  align?: 'right'
}) {
  return (
    <th
      className={`bg-(--card-2) font-mono text-[10px] uppercase tracking-[0.08em] text-(--ink-4) px-3 py-2.5 font-medium border-b border-(--line) ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className = '',
  align,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'right'
}) {
  return (
    <td
      className={`px-3 py-3 border-b border-(--line-2) text-[13px] ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {children}
    </td>
  )
}

// ── Empty-tab state ────────────────────────────────────────────────

function EmptyTab() {
  return (
    <div className="py-20 px-10 text-center border border-dashed border-(--line) rounded-2xl bg-(--card-2)">
      <div className="w-15 h-15 mx-auto mb-5 rounded-full bg-(--accent-soft) grid place-items-center text-(--accent)">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 3h14l-1.5 8h-11z" />
          <path d="M4 14h16" />
          <path d="M9 21h6" />
          <path d="M12 14v7" />
        </svg>
      </div>
      <h2 className="text-[22px] font-medium m-0 mb-2 text-(--ink) tracking-tight">
        Your records will live here.
      </h2>
      <p className="text-[14px] text-(--ink-3) mx-auto max-w-[42ch] leading-relaxed">
        Run any of the standard distances — 1K, 1 mile, 5K, 10K, half, or
        marathon — and Reko will surface your fastest effort across every
        activity automatically.
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

export default function Records({ data, runs, unit }: Props) {
  const now = useMemo(() => new Date(), [])

  // Hydrate distances against the canonical order so the list is
  // deterministic even if the loader returns them out of order. (It
  // already returns them ordered, but defending against future drift.)
  const distancesByKey = useMemo(() => {
    const m = new Map<string, DistanceRecord>()
    for (const d of data.distances) m.set(d.key, d)
    return m
  }, [data.distances])

  const orderedDistances = DISTANCE_DEFS.map(
    (def) =>
      distancesByKey.get(def.key) ?? {
        key: def.key,
        label: def.label,
        meters: def.meters,
        best: null,
        runnerUp: null,
        thirdBest: null,
        trend: [],
      },
  )

  // The hero is whichever distance was most recently PR'd. Tied dates
  // fall back to the canonical order.
  const heroDistance = useMemo(() => {
    const withBest = orderedDistances.filter((d) => d.best)
    if (withBest.length === 0) return null
    return withBest.reduce((latest, d) =>
      parseLocalDate(d.best!.startDateLocal).getTime() >
      parseLocalDate(latest.best!.startDateLocal).getTime()
        ? d
        : latest,
    )
  }, [orderedDistances])

  const totalPrs = orderedDistances.filter((d) => d.best).length

  if (totalPrs === 0) return <EmptyTab />

  const slimList = orderedDistances.filter(
    (d) => d.key !== heroDistance?.key,
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Hero */}
      {heroDistance && <HeroPR rec={heroDistance} unit={unit} now={now} />}

      {/* Per-distance expandable list */}
      <div className="bg-(--card) border border-(--line) rounded-2xl overflow-hidden">
        {slimList.map((rec) => (
          <DistanceRow key={rec.key} rec={rec} unit={unit} now={now} />
        ))}
      </div>

      {/* Three accordions */}
      <Disclosure
        title="Progression over time"
        meta={`${totalPrs} distance${totalPrs === 1 ? '' : 's'} tracked`}
      >
        <ProgressionChart distances={orderedDistances} />
      </Disclosure>

      <Disclosure
        title="Best pace by distance range"
        meta={`6 buckets · fastest ${unit} per bucket`}
      >
        <PaceByRange
          distances={orderedDistances}
          runs={runs}
          unit={unit}
        />
      </Disclosure>

      <Disclosure
        title="PR history"
        meta={`${totalPrs} record${totalPrs === 1 ? '' : 's'}`}
      >
        <PRHistory distances={orderedDistances} unit={unit} />
      </Disclosure>
    </div>
  )
}
