/**
 * Collapsible per-distance row.
 *
 * Closed: dist + time + pace + when.
 * Open: activity link, runner-up, 3rd best, and a chronological
 * sparkline of all-time PR progression.
 *
 * Sparkline and RunnerRow are co-located here — they're only used
 * inside DistanceRow and aren't worth their own files.
 */

import { ChevronRight } from 'lucide-react'
import { formatDuration } from '../../../lib/strava'
import type { Unit } from '../../../lib/activities'
import type { DistanceRecord, RecordEffort } from '../distances'
import { formatDate, relTime, paceForDist, formatPace, isRecent } from './helpers'

type Props = {
  rec: DistanceRecord
  unit: Unit
  now: Date
}

// ── Sparkline (local) ────────────────────────────────────────────

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

// ── RunnerRow (local) ────────────────────────────────────────────

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

// ── DistanceRow ──────────────────────────────────────────────────

export default function DistanceRow({ rec, unit, now }: Props) {
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
