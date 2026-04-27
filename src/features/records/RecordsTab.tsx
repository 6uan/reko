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
import { formatDuration } from '../../lib/strava'
import type {
  RecordsData,
  DistanceRecord,
  RecordEffort,
} from './getRecordsData'
import { DISTANCE_DEFS } from './getRecordsData'

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
  data: RecordsData
  runs: DashboardRun[]
  unit: 'km' | 'mi'
}

const KM_PER_MI = 1609.34

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

function paceForDist(seconds: number, meters: number, unit: 'km' | 'mi') {
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
  unit: 'km' | 'mi'
  now: Date
}) {
  const unitLabel = unit === 'km' ? '/km' : '/mi'

  if (!rec.best) {
    return (
      <div className="grid grid-cols-[110px_1fr_1fr_1fr_24px] items-center px-5 py-4 border-b border-[var(--line)] last:border-b-0">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
          {rec.label}
        </span>
        <span className="font-mono text-[14px] text-[var(--ink-4)]">
          no PR yet
        </span>
        <span className="text-[var(--ink-4)]">—</span>
        <span className="font-mono text-[11px] text-[var(--ink-4)] text-right">
          awaiting first effort
        </span>
        <span />
      </div>
    )
  }

  const pace = paceForDist(rec.best.elapsedTime, rec.meters, unit)
  const recent = isRecent(rec.best.startDateLocal, now, 30)

  return (
    <details className="group border-b border-[var(--line)] last:border-b-0 [&[open]]:bg-[var(--card-2)]">
      <summary className="grid grid-cols-[110px_1fr_1fr_1fr_24px] items-center px-5 py-4 cursor-pointer list-none hover:bg-[var(--card-2)] transition-colors [&::-webkit-details-marker]:hidden">
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--ink-3)]">
          {rec.label}
        </span>
        <span className="font-mono text-[18px] font-medium tabular-nums text-[var(--ink)] tracking-tight">
          {formatDuration(rec.best.elapsedTime)}
        </span>
        <span className="font-mono text-[12px] tabular-nums text-[var(--ink-3)]">
          {formatPace(pace)}
          <span className="ml-0.5">{unitLabel}</span>
        </span>
        <span className="font-mono text-[11px] text-[var(--ink-4)] text-right">
          {relTime(rec.best.startDateLocal, now)}
        </span>
        <ChevronRight
          size={14}
          className="text-[var(--ink-3)] transition-transform duration-150 group-open:rotate-90 justify-self-end"
        />
      </summary>

      {/* Expanded body */}
      <div className="px-5 pb-5 pt-1 grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-6 border-t border-[var(--line)]">
        {/* Left: PR detail */}
        <div className="flex flex-col gap-3 pt-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)]">
              Set on
            </div>
            <div className="font-mono text-[13px] text-[var(--ink-2)] mt-1">
              {formatDate(rec.best.startDateLocal)}
            </div>
            <a
              href={`https://www.strava.com/activities/${rec.best.activityId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[12px] text-[var(--ink-3)] hover:text-[var(--accent)] no-underline mt-1 inline-block"
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
        <div className="flex flex-col gap-3 pt-4 md:border-l md:border-[var(--line)] md:pl-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)]">
            Progression · {rec.trend.length} PR{rec.trend.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-end gap-3">
            <Sparkline trend={rec.trend} recent={recent} />
            {rec.runnerUp && (
              <div className="font-mono text-[11px] text-[var(--ink-3)] tabular-nums">
                <span className="text-[var(--accent)]">
                  −{formatDuration(rec.runnerUp.elapsedTime - rec.best.elapsedTime)}
                </span>
                <span className="text-[var(--ink-4)] ml-1">
                  vs prev
                </span>
              </div>
            )}
          </div>
          {rec.trend.length === 1 && (
            <div className="font-mono text-[11px] text-[var(--ink-4)]">
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
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)]">
        {label}
      </span>
      <span className="font-mono text-[13px] tabular-nums">
        {formatDuration(effort.elapsedTime)}
        <span className="text-[var(--ink-4)] ml-2">
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
  unit: 'km' | 'mi'
  now: Date
}) {
  if (!rec.best) return null
  const unitLabel = unit === 'km' ? '/km' : '/mi'
  const pace = paceForDist(rec.best.elapsedTime, rec.meters, unit)
  const prev = rec.runnerUp?.elapsedTime ?? null
  const delta = prev !== null ? prev - rec.best.elapsedTime : 0
  const pct = prev !== null && prev > 0 ? (delta / prev) * 100 : 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_1.4fr] bg-[var(--card)] border border-[var(--line)] rounded-2xl overflow-hidden">
      {/* Left: distance + big time */}
      <div className="px-9 py-8 flex flex-col justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--accent)]">
            <span className="relative inline-block w-[7px] h-[7px] rounded-full bg-[var(--accent)]">
              <span className="absolute inset-[-3px] rounded-full border-[1.5px] border-[var(--accent)] opacity-0 animate-[pulse-ring_2s_ease-out_infinite]" />
            </span>
            Latest PR · {relTime(rec.best.startDateLocal, now)}
          </span>
          <div className="mt-3.5 text-[18px] font-medium text-[var(--ink-2)] tracking-tight">
            {rec.label}
          </div>
          <div className="mt-1.5 font-mono text-[64px] md:text-[76px] font-medium tabular-nums tracking-[-0.035em] text-[var(--ink)] leading-none">
            {formatDuration(rec.best.elapsedTime)}
          </div>
          <div className="mt-3 font-mono text-[14px] tabular-nums text-[var(--ink-3)]">
            {formatPace(pace)} {unitLabel}
          </div>
        </div>
        <div className="flex flex-col gap-1 font-mono text-[11px]">
          <span className="text-[var(--ink-2)]">
            {formatDate(rec.best.startDateLocal)}
          </span>
          <a
            href={`https://www.strava.com/activities/${rec.best.activityId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--ink-3)] hover:text-[var(--accent)] no-underline"
          >
            {rec.best.activityName} ↗
          </a>
        </div>
      </div>

      {/* Right: improvement breakdown */}
      <div className="px-9 py-8 border-t md:border-t-0 md:border-l border-[var(--line)] bg-[var(--card-2)]">
        <h4 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ink-4)] mb-4 font-medium">
          Improvement
        </h4>
        {prev !== null ? (
          <>
            <div className="flex items-baseline gap-2.5 mb-6">
              <span className="font-mono text-[28px] font-medium text-[var(--accent)] tabular-nums tracking-[-0.02em]">
                −{formatDuration(delta)}
              </span>
              <span className="font-mono text-[13px] text-[var(--ink-3)]">
                {pct.toFixed(1)}% faster
              </span>
            </div>
            <div className="flex justify-between items-baseline py-2.5 border-t border-[var(--line)] font-mono text-[12px]">
              <span className="text-[var(--ink-4)] uppercase text-[10px] tracking-[0.1em]">
                Previous best
              </span>
              <span className="text-[var(--ink-2)] tabular-nums">
                {formatDuration(prev)}
              </span>
            </div>
            {rec.thirdBest && (
              <div className="flex justify-between items-baseline py-2.5 border-t border-[var(--line)] font-mono text-[12px]">
                <span className="text-[var(--ink-4)] uppercase text-[10px] tracking-[0.1em]">
                  3rd best
                </span>
                <span className="text-[var(--ink-2)] tabular-nums">
                  {formatDuration(rec.thirdBest.elapsedTime)} ·{' '}
                  {relTime(rec.thirdBest.startDateLocal, now)}
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="font-mono text-[12px] text-[var(--ink-3)] leading-relaxed">
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
    <details className="group bg-[var(--card)] border border-[var(--line)] rounded-2xl overflow-hidden [&[open]]:border-[rgba(252,76,2,0.18)] transition-colors">
      <summary className="flex justify-between items-center px-5 py-4 cursor-pointer list-none hover:bg-[var(--card-2)] transition-colors [&::-webkit-details-marker]:hidden">
        <span className="text-[14px] font-medium text-[var(--ink)] tracking-tight">
          {title}
        </span>
        <span className="flex items-center gap-3 font-mono text-[11px] text-[var(--ink-4)]">
          {meta}
          <ChevronRight
            size={12}
            className="text-[var(--ink-3)] transition-transform duration-150 group-open:rotate-90"
          />
        </span>
      </summary>
      <div className="border-t border-[var(--line)]">{children}</div>
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

function ProgressionChart({
  distances,
  now,
}: {
  distances: DistanceRecord[]
  now: Date
}) {
  const distancesWithTrend = distances.filter((d) => d.trend.length > 0)
  if (distancesWithTrend.length === 0) {
    return (
      <div className="p-10 text-center font-mono text-[12px] text-[var(--ink-3)]">
        No PR history yet — keep running and the chart will fill in.
      </div>
    )
  }

  const W = 920
  const H = 240
  const pad = 28
  const allDates = distancesWithTrend.flatMap((d) =>
    d.trend.map((p) => parseLocalDate(p.date).getTime()),
  )
  const xMin = Math.min(...allDates)
  const xMax = now.getTime()
  const xRange = xMax - xMin || 1
  const xPos = (t: number) => pad + ((t - xMin) / xRange) * (W - pad * 2)

  const series = distancesWithTrend.map((d) => {
    const tr = d.trend
    const best = Math.min(...tr.map((p) => p.time))
    const worst = Math.max(...tr.map((p) => p.time))
    const fullRange = Math.max(worst / best - 1, 0.05)
    const yPos = (t: number) =>
      pad + ((t / best - 1) / fullRange) * (H - pad * 2)
    const points = tr.map(
      (p) => [xPos(parseLocalDate(p.date).getTime()), yPos(p.time)] as const,
    )
    const path = points
      .map(
        (p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1),
      )
      .join(' ')
    return {
      key: d.key,
      path,
      points,
      color: DISTANCE_COLORS[d.key] ?? 'var(--ink-3)',
      label: d.label,
    }
  })

  // Quarterly x-axis ticks.
  const ticks: number[] = []
  const monthMs = 30 * 86400000
  let t = xMin
  while (t <= xMax) {
    ticks.push(t)
    t += monthMs * 3
  }

  return (
    <div className="p-5">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-[14px] font-medium text-[var(--ink)]">
          PR progression · % above best
        </h4>
        <span className="font-mono text-[11px] text-[var(--ink-3)]">
          all-time PRs across distances
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height: 240, overflow: 'visible' }}
      >
        {ticks.map((tt) => {
          const d = new Date(tt)
          return (
            <g key={tt}>
              <line
                x1={xPos(tt)}
                x2={xPos(tt)}
                y1={pad}
                y2={H - pad}
                stroke="var(--line)"
                strokeDasharray="2 4"
              />
              <text
                x={xPos(tt)}
                y={H - 8}
                fontFamily="var(--font-mono)"
                fontSize={9}
                fill="var(--ink-4)"
                textAnchor="middle"
              >
                {d.toLocaleDateString('en', { month: 'short' })} '
                {String(d.getFullYear()).slice(2)}
              </text>
            </g>
          )
        })}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={pad}
            x2={W - pad}
            y1={pad + p * (H - pad * 2)}
            y2={pad + p * (H - pad * 2)}
            stroke="var(--line-2)"
          />
        ))}
        <text
          x={pad - 6}
          y={pad + 4}
          fontFamily="var(--font-mono)"
          fontSize={9}
          fill="var(--ink-4)"
          textAnchor="end"
        >
          PR
        </text>
        <text
          x={pad - 6}
          y={H - pad + 3}
          fontFamily="var(--font-mono)"
          fontSize={9}
          fill="var(--ink-4)"
          textAnchor="end"
        >
          slower
        </text>
        {series.map((s) => (
          <g key={s.key}>
            <path
              d={s.path}
              fill="none"
              stroke={s.color}
              strokeWidth={1.8}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.points.map((p, i) => (
              <circle
                key={i}
                cx={p[0]}
                cy={p[1]}
                r={3}
                fill="var(--card)"
                stroke={s.color}
                strokeWidth={1.8}
              />
            ))}
          </g>
        ))}
      </svg>
      <div className="flex gap-3.5 flex-wrap font-mono text-[11px] text-[var(--ink-3)] mt-3">
        {series.map((s) => (
          <span
            key={s.key}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md"
          >
            <span
              className="inline-block w-2.5 h-0.5 rounded-sm"
              style={{ background: s.color }}
            />
            {s.label}
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
  unit: 'km' | 'mi'
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
      <table className="w-full text-left border-collapse min-w-[640px]">
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
                  <Td className="text-[var(--ink)] font-medium">
                    {bucket.key}
                  </Td>
                  <Td className="text-[var(--ink-4)]">—</Td>
                  <Td />
                  <Td className="text-[var(--ink-4)]">—</Td>
                  <Td className="text-[var(--ink-4)]">—</Td>
                  <Td align="right" className="text-[var(--ink-4)] tabular-nums">
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
                <Td className="text-[var(--ink)] font-medium">{bucket.key}</Td>
                <Td className="font-mono tabular-nums">
                  <span
                    className={
                      isFastest
                        ? 'text-[var(--accent)] font-medium'
                        : 'text-[var(--ink-2)]'
                    }
                  >
                    {formatPace(pace)}
                  </span>
                  <span className="text-[var(--ink-4)] ml-1">{unitLabel}</span>
                </Td>
                <Td>
                  <div className="inline-flex items-center min-w-[120px]">
                    <div className="h-1 rounded-sm bg-[var(--line-2)] flex-1 overflow-hidden">
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
                <Td className="font-mono tabular-nums text-[var(--ink-2)]">
                  {formatDuration(best.elapsedTime)}
                </Td>
                <Td className="text-[var(--ink-3)] truncate max-w-[200px]">
                  <a
                    href={`https://www.strava.com/activities/${best.activityId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--ink-2)] no-underline hover:text-[var(--accent)]"
                  >
                    {best.activityName}
                  </a>
                </Td>
                <Td align="right" className="font-mono tabular-nums text-[var(--ink-3)]">
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
  unit: 'km' | 'mi'
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
      <div className="p-10 text-center font-mono text-[12px] text-[var(--ink-3)]">
        No personal records yet.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[720px]">
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
                <Td className="font-mono text-[11px] text-[var(--ink-3)] tabular-nums">
                  {formatDate(best.startDateLocal)}
                </Td>
                <Td className="text-[var(--ink)] font-medium">{r.label}</Td>
                <Td className="font-mono tabular-nums text-[var(--ink)]">
                  {formatDuration(best.elapsedTime)}
                </Td>
                <Td className="font-mono tabular-nums text-[var(--ink)]">
                  {formatPace(pace)}
                  <span className="text-[var(--ink-3)] ml-0.5">{unitLabel}</span>
                </Td>
                <Td>
                  <a
                    href={`https://www.strava.com/activities/${best.activityId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--ink-2)] no-underline hover:text-[var(--accent)]"
                  >
                    {best.activityName}
                  </a>
                </Td>
                <Td className="font-mono tabular-nums text-[var(--ink-3)]">
                  {prev !== null ? formatDuration(prev) : '—'}
                </Td>
                <Td className="font-mono tabular-nums text-[var(--accent)]">
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
      className={`bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--ink-4)] px-3 py-2.5 font-medium border-b border-[var(--line)] ${
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
      className={`px-3 py-3 border-b border-[var(--line-2)] text-[13px] ${
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
    <div className="py-20 px-10 text-center border border-dashed border-[var(--line)] rounded-2xl bg-[var(--card-2)]">
      <div className="w-[60px] h-[60px] mx-auto mb-5 rounded-full bg-[var(--accent-soft)] grid place-items-center text-[var(--accent)]">
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
      <h2 className="text-[22px] font-medium m-0 mb-2 text-[var(--ink)] tracking-tight">
        Your records will live here.
      </h2>
      <p className="text-[14px] text-[var(--ink-3)] mx-auto max-w-[42ch] leading-relaxed">
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
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-2xl overflow-hidden">
        {slimList.map((rec) => (
          <DistanceRow key={rec.key} rec={rec} unit={unit} now={now} />
        ))}
      </div>

      {/* Three accordions */}
      <Disclosure
        title="Progression over time"
        meta={`${totalPrs} distance${totalPrs === 1 ? '' : 's'} tracked`}
      >
        <ProgressionChart distances={orderedDistances} now={now} />
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
