import { useMemo } from 'react'
import {
  formatPace,
  formatDuration,
  getMonday,
} from '../../lib/strava'
import {
  KM_PER_MI,
  toDisplayDistance,
  avg,
  type Activity,
  type Unit,
} from '../../lib/activities'

type Props = { runs: Activity[]; unit: Unit }

// ── Helpers ───────────────────────────────────────────────────────

function distInUnit(meters: number, unit: Unit) {
  return unit === 'mi' ? meters / KM_PER_MI : meters / 1000
}

/** Pace from distance + moving time (not avgSpeed). Used here because
 *  PaceTab ranks runs by actual elapsed pace, not Strava's avg speed. */
function paceForRun(run: Activity, unit: Unit) {
  const d = distInUnit(run.distanceMeters, unit)
  return d > 0 ? run.movingTime / d : 0
}

// ── Component ─────────────────────────────────────────────────────

export default function Pace({ runs, unit }: Props) {
  const unitLabel = unit === 'mi' ? '/mi' : '/km'

  // ── KPI calculations ────────────────────────────────────────────

  const paces = useMemo(() => runs.map((r) => paceForRun(r, unit)), [runs, unit])

  const now = new Date()
  const thisMonthRuns = useMemo(
    () =>
      runs.filter((r) => {
        const d = new Date(r.date)
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }),
    [runs],
  )

  const currentAvgPace = useMemo(() => {
    const mp = thisMonthRuns.map((r) => paceForRun(r, unit)).filter((p) => p > 0)
    return avg(mp)
  }, [thisMonthRuns, unit])

  const fastestPace = useMemo(() => {
    const valid = paces.filter((p) => p > 0)
    return valid.length ? Math.min(...valid) : 0
  }, [paces])

  const easyAvg = useMemo(() => {
    const easy = runs
      .filter((r) => r.avgHr !== null && r.avgHr < 150)
      .map((r) => paceForRun(r, unit))
      .filter((p) => p > 0)
    return avg(easy)
  }, [runs, unit])

  const tempoAvg = useMemo(() => {
    const tempo = runs
      .filter((r) => r.avgHr !== null && r.avgHr >= 155)
      .map((r) => paceForRun(r, unit))
      .filter((p) => p > 0)
    return avg(tempo)
  }, [runs, unit])

  // ── Histogram bins ──────────────────────────────────────────────

  const histogram = useMemo(() => {
    const valid = paces.filter((p) => p > 0)
    if (!valid.length) return { bins: [] as number[], min: 0, max: 0, maxCount: 0 }
    const min = Math.min(...valid)
    const max = Math.max(...valid)
    const binCount = 10
    const binSize = (max - min) / binCount || 1
    const bins = Array(binCount).fill(0) as number[]
    valid.forEach((p) => {
      const idx = Math.min(Math.floor((p - min) / binSize), binCount - 1)
      bins[idx]++
    })
    return { bins, min, max, maxCount: Math.max(...bins) }
  }, [paces])

  // ── 90-day trend (weekly buckets) ───────────────────────────────

  const trendData = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const recent = runs.filter((r) => new Date(r.date) >= cutoff)

    const buckets = new Map<string, number[]>()
    recent.forEach((r) => {
      const mon = getMonday(new Date(r.date))
      const key = mon.toISOString().slice(0, 10)
      const p = paceForRun(r, unit)
      if (p > 0) {
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push(p)
      }
    })

    const sorted = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, vals]) => ({ week, avg: avg(vals) }))

    return sorted
  }, [runs, unit])

  // ── Fastest runs (sorted by pace, ascending) ───────────────────

  const fastestRuns = useMemo(() => {
    return [...runs]
      .filter((r) => r.avgSpeed > 0)
      .sort((a, b) => b.avgSpeed - a.avgSpeed)
      .slice(0, 20)
  }, [runs])

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard
          label="Current avg"
          value={formatPace(currentAvgPace)}
          unit={unitLabel}
          detail={`${thisMonthRuns.length} runs this month`}
        />
        <KpiCard
          label="Fastest ever"
          value={formatPace(fastestPace)}
          unit={unitLabel}
          detail="All-time best"
        />
        <KpiCard
          label="Easy avg"
          value={formatPace(easyAvg)}
          unit={unitLabel}
          detail="Avg HR < 150 bpm"
        />
        <KpiCard
          label="Tempo avg"
          value={formatPace(tempoAvg)}
          unit={unitLabel}
          detail="Avg HR ≥ 155 bpm"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Histogram */}
        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4.5">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-[15px] font-medium">Pace distribution · all runs</h3>
            <span className="font-mono text-[11px] text-(--ink-3)">
              {runs.length} runs
            </span>
          </div>
          <HistogramChart
            bins={histogram.bins}
            minPace={histogram.min}
            maxPace={histogram.max}
            maxCount={histogram.maxCount}
          />
        </div>

        {/* Trend line */}
        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4.5">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-[15px] font-medium">Avg pace · 90d trend</h3>
            <span className="font-mono text-[11px] text-(--ink-3)">
              {trendData.length} weeks
            </span>
          </div>
          <TrendChart data={trendData} />
        </div>
      </div>

      {/* Fastest runs table */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-(--line)">
          <h3 className="text-[15px] font-medium text-(--ink)">
            Fastest runs
          </h3>
          <p className="font-mono text-[11px] text-(--ink-4)] mt-0.5">
            Sorted by pace, fastest first
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-(--card-2)">
                {['#', 'Activity', 'Pace', 'Distance', 'Time', 'Avg HR', 'Date'].map((h) => (
                  <th
                    key={h}
                    className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)] px-3 py-2.5 text-left font-medium"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fastestRuns.map((run, i) => {
                const pace = paceForRun(run, unit)
                return (
                  <tr key={run.id}>
                    <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3)">
                      {i + 1}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) font-medium text-(--ink)">
                      {run.name}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) font-mono tabular-nums">
                      <span className={i === 0 ? 'text-(--accent) font-medium' : 'text-(--ink)'}>
                        {formatPace(pace)}
                      </span>
                      <span className="text-(--ink-3) text-xs ml-0.5">{unitLabel}</span>
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) font-mono tabular-nums text-(--ink-3)">
                      {toDisplayDistance(run.distanceMeters, unit)} {unit}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) font-mono tabular-nums text-(--ink-3)">
                      {formatDuration(run.movingTime)}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) font-mono tabular-nums text-(--ink-3)">
                      {run.avgHr !== null ? `${Math.round(run.avgHr)} bpm` : '—'}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) font-mono tabular-nums text-(--ink-3)">
                      {new Date(run.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                )
              })}
              {fastestRuns.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-[13px] text-(--ink-3)">
                    No pace data yet
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

// ── Sub-components ────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  detail,
}: {
  label: string
  value: string
  unit: string
  detail: string
}) {
  return (
    <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
        {label}
      </div>
      <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
        {value}
        <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">{unit}</span>
      </div>
      <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">{detail}</div>
    </div>
  )
}

function HistogramChart({
  bins,
  minPace,
  maxPace,
  maxCount,
}: {
  bins: number[]
  minPace: number
  maxPace: number
  maxCount: number
}) {
  if (!bins.length) {
    return (
      <svg viewBox="0 0 560 180" className="w-full">
        <text x="280" y="100" textAnchor="middle" fill="var(--ink-4)" fontSize="12">
          No data
        </text>
      </svg>
    )
  }

  const barW = 46
  const gap = 8
  const totalW = bins.length * barW + (bins.length - 1) * gap
  const offsetX = (560 - totalW) / 2
  const chartH = 130
  const topPad = 20

  return (
    <svg viewBox="0 0 560 180" className="w-full">
      {bins.map((count, i) => {
        const x = offsetX + i * (barW + gap)
        const barH = maxCount > 0 ? (count / maxCount) * chartH : 0
        const y = topPad + chartH - barH
        const isTallest = count === maxCount && count > 0
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill={isTallest ? 'var(--accent)' : '#d6cfbc'}
            />
            {count > 0 && (
              <text
                x={x + barW / 2}
                y={y - 5}
                textAnchor="middle"
                fontSize="10"
                fontFamily="var(--font-mono)"
                fill="var(--ink-3)"
              >
                {count}
              </text>
            )}
          </g>
        )
      })}
      <text
        x={offsetX}
        y={topPad + chartH + 18}
        fontSize="10"
        fontFamily="var(--font-mono)"
        fill="var(--ink-4)"
      >
        {formatPace(minPace)}
      </text>
      <text
        x={offsetX + totalW}
        y={topPad + chartH + 18}
        textAnchor="end"
        fontSize="10"
        fontFamily="var(--font-mono)"
        fill="var(--ink-4)"
      >
        {formatPace(maxPace)}
      </text>
    </svg>
  )
}

function TrendChart({ data }: { data: { week: string; avg: number }[] }) {
  if (!data.length) {
    return (
      <svg viewBox="0 0 560 180" className="w-full">
        <text x="280" y="100" textAnchor="middle" fill="var(--ink-4)" fontSize="12">
          No data
        </text>
      </svg>
    )
  }

  const padL = 10
  const padR = 10
  const padT = 10
  const padB = 10
  const chartW = 560 - padL - padR
  const chartH = 180 - padT - padB

  const values = data.map((d) => d.avg)
  const minV = Math.min(...values) * 0.97
  const maxV = Math.max(...values) * 1.03

  const points = data.map((d, i) => {
    const x = padL + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW)
    const y = padT + chartH - ((d.avg - minV) / (maxV - minV)) * chartH
    return { x, y }
  })

  const lineD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = `${lineD} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`

  return (
    <svg viewBox="0 0 560 180" className="w-full">
      <path d={areaD} fill="var(--accent)" opacity={0.12} />
      <path d={lineD} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--accent)" />
      ))}
    </svg>
  )
}
