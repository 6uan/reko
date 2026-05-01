/**
 * Multi-distance line chart showing PR progression over time.
 *
 * Y axis is "% slower than the all-time best" per distance, so
 * different distances share the same scale — the top of the chart
 * is "PR" and the bottom is "slowest tracked effort."
 */

import { useMemo } from 'react'
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
import { formatDuration } from '@/lib/strava'
import type { DistanceRecord } from '@/features/dashboard/records/distances'
import { parseLocalDate, formatDate } from '@/lib/dates'

const DISTANCE_COLORS: Record<string, string> = {
  '1k': '#6ac6dc',
  '1mi': '#7dce72',
  '5k': 'var(--accent)',
  '10k': '#f3c64a',
  half: '#c39ddc',
  mar: '#ef8944',
}

type Props = { distances: DistanceRecord[] }

export default function ProgressionChart({ distances }: Props) {
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
      <div className="p-10 text-center text-detail">
        No PR history yet — keep running and the chart will fill in.
      </div>
    )
  }

  const labelByKey = Object.fromEntries(
    withTrend.map((d) => [d.key, d.label]),
  ) as Record<string, string>

  const renderTooltip = ({
    active,
    payload,
    label,
  }: TooltipContentProps) => {
    if (!active || !payload || payload.length === 0 || label == null) return null
    const date = formatDate(new Date(Number(label)))
    return (
      <div className="bg-(--card) border border-(--line) rounded-(--radius-s) shadow-(--shadow-m) px-3 py-2 font-mono text-[11px] min-w-45">
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
        <h4 className="text-section">
          PR progression
        </h4>
        <span className="text-detail">
          % above all-time best per distance
        </span>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
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
      <div className="flex gap-4 flex-wrap text-detail mt-3">
        {withTrend.map((d) => (
          <span
            key={d.key}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-(--radius-s)"
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
