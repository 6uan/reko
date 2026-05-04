/**
 * Average pace trend line chart (all time, weekly buckets) built with Recharts.
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
} from 'recharts'
import { formatPace } from '@/lib/strava'
import { paceUnit, type Unit } from '@/lib/activities'
import Card from '@/features/dashboard/ui/Card'
import ChartContainer from '@/features/dashboard/ui/ChartContainer'
import ChartTooltip from '@/features/dashboard/ui/ChartTooltip'

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
  const paceLabel = paceUnit(unit)

  return (
    <ChartTooltip>
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
    </ChartTooltip>
  )
}

export default function PaceChart({ data, unit }: Props) {
  if (data.length <= 1) {
    return (
      <Card className="p-4">
        <span className="text-eyebrow">Avg pace trend</span>
        <div className="mt-3 h-[180px] flex items-center justify-center">
          <span className="text-sm text-(--ink-4)">Not enough data</span>
        </div>
      </Card>
    )
  }

  // Lower pace = faster. We want faster at the bottom (closer to 0),
  // so the natural Y-axis direction is correct — no `reversed`.
  const paces = data.map((d) => d.pace)
  const paceMin = Math.min(...paces)
  const paceMax = Math.max(...paces)
  const padding = (paceMax - paceMin) * 0.15 || 10

  return (
    <Card className="p-4">
      <span className="text-eyebrow">Avg pace trend</span>
      <ChartContainer height={180}>
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
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
            domain={[paceMin - padding, paceMax + padding]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
            tickFormatter={(v: number) => formatPace(v)}
            width={50}
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
      </ChartContainer>
    </Card>
  )
}
