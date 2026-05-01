/**
 * Monthly volume bar chart (trailing 12 months) built with Recharts.
 *
 * Each bar represents one month's total distance. Hovering shows:
 *   - Month name
 *   - Total distance
 *   - Number of runs
 *   - Total time
 *   - Avg pace
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatPace, formatDuration } from '../../../lib/strava'
import { toDisplayDistance, type Unit } from '../../../lib/activities'

export type MonthBucket = {
  /** Short label for X axis, e.g. "Jan", "Feb" */
  label: string
  /** Full label for tooltip, e.g. "January 2026" */
  fullLabel: string
  /** Distance in display units (km or mi) */
  distance: number
  /** Raw distance in meters (for tooltip formatting) */
  distanceMeters: number
  /** Number of runs */
  runs: number
  /** Total moving time in seconds */
  time: number
  /** Average pace in seconds per unit (for tooltip) */
  avgPace: number
}

type Props = {
  data: MonthBucket[]
  unit: Unit
}

function CustomTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: Array<{ payload: MonthBucket }>
  unit: Unit
}) {
  if (!active || !payload?.[0]) return null

  const d = payload[0].payload
  const unitLabel = unit === 'mi' ? 'mi' : 'km'
  const paceLabel = unit === 'mi' ? '/mi' : '/km'

  return (
    <div className="bg-(--card) border border-(--line) rounded-lg shadow-(--shadow-m) px-3 py-2.5 text-[12px]">
      <p className="font-medium text-(--ink) mb-1.5">{d.fullLabel}</p>
      <div className="space-y-0.5 text-(--ink-2)">
        <p>
          <span className="text-(--ink) font-mono tabular-nums font-medium">
            {toDisplayDistance(d.distanceMeters, unit)}
          </span>{' '}
          {unitLabel}
        </p>
        <p>
          {d.runs} run{d.runs !== 1 ? 's' : ''} ·{' '}
          {formatDuration(d.time)}
        </p>
        {d.avgPace > 0 && (
          <p>
            Avg{' '}
            <span className="font-mono tabular-nums">
              {formatPace(d.avgPace)}
            </span>{' '}
            {paceLabel}
          </p>
        )}
      </div>
    </div>
  )
}

export default function VolumeChart({ data, unit }: Props) {
  return (
    <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
      <span className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
        Monthly volume · 12 months
      </span>
      <div className="mt-3 h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
          >
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: 'var(--ink-4)' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
              width={45}
            />
            <Tooltip
              content={<CustomTooltip unit={unit} />}
              cursor={{ fill: 'var(--bg-2)', radius: 6 }}
            />
            <Bar
              dataKey="distance"
              radius={[6, 6, 0, 0]}
              fill="var(--accent)"
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
