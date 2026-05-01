/**
 * Average pace trend line chart (trailing 13 weeks) built with Recharts.
 *
 * Each point is one week's average pace. Hovering shows:
 *   - Week date range
 *   - Average pace
 *   - Number of runs that week
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatPace } from '../../../lib/strava'
import type { Unit } from '../../../lib/activities'

export type PacePoint = {
  /** Short label for X axis, e.g. "4/7" */
  label: string
  /** Full label for tooltip, e.g. "Apr 7 – Apr 13" */
  fullLabel: string
  /** Pace in seconds per display unit */
  pace: number
  /** Number of runs that week */
  runs: number
}

type Props = {
  data: PacePoint[]
  unit: Unit
}

function CustomTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: Array<{ payload: PacePoint }>
  unit: Unit
}) {
  if (!active || !payload?.[0]) return null

  const d = payload[0].payload
  const paceLabel = unit === 'mi' ? '/mi' : '/km'

  return (
    <div className="bg-(--card) border border-(--line) rounded-lg shadow-(--shadow-m) px-3 py-2.5 text-[12px]">
      <p className="font-medium text-(--ink) mb-1.5">{d.fullLabel}</p>
      <div className="space-y-0.5 text-(--ink-2)">
        <p>
          Avg{' '}
          <span className="text-(--ink) font-mono tabular-nums font-medium">
            {formatPace(d.pace)}
          </span>{' '}
          {paceLabel}
        </p>
        <p>
          {d.runs} run{d.runs !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  )
}

export default function PaceChart({ data, unit }: Props) {
  if (data.length <= 1) {
    return (
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
        <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
          Avg pace · 13 weeks
        </span>
        <div className="mt-3 h-[180px] flex items-center justify-center">
          <span className="text-sm text-(--ink-4)">Not enough data</span>
        </div>
      </div>
    )
  }

  // Pace is inverted — lower is faster. We want faster (lower) at the top
  // of the chart. Recharts' YAxis reversed prop handles this.
  const paces = data.map((d) => d.pace)
  const paceMin = Math.min(...paces)
  const paceMax = Math.max(...paces)
  const padding = (paceMax - paceMin) * 0.15 || 10

  return (
    <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
        Avg pace · 13 weeks
      </span>
      <div className="mt-3 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <defs>
              <linearGradient id="paceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--ink-4)' }}
            />
            <YAxis
              reversed
              domain={[paceMin - padding, paceMax + padding]}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
              tickFormatter={(v: number) => formatPace(v)}
              width={45}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} />}
              cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }}
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
              activeDot={{ r: 6, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--card)' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
