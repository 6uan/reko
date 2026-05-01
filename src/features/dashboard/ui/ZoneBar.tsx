/**
 * One row in a zone-distribution chart. Used by Heart Rate "Time in zones"
 * and Cadence "Cadence zones".
 *
 *   ● Z1 Recovery  ████████░░░░░░░░░░░  35.5%
 *
 * `active` controls the bar visibility — when there's no data for a zone
 * we still render the row but hide the fill (opacity 0).
 */

import type { ReactNode } from 'react'
import ColorDot from './ColorDot'

type Props = {
  label: ReactNode
  color: string
  /** Width of the bar fill, 0–100. */
  pct: number
  /** Whether the zone has any data. Hides the bar fill when false. */
  active?: boolean
  /** Right-side metric (e.g. "35.5%", "21 runs"). */
  rightLabel: ReactNode
  /** Tailwind width class for the label column (defaults to w-24). */
  labelWidth?: string
  /** Tailwind width class for the right metric column (defaults to w-16). */
  rightWidth?: string
}

export default function ZoneBar({
  label,
  color,
  pct,
  active = true,
  rightLabel,
  labelWidth = 'w-24',
  rightWidth = 'w-16',
}: Props) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`font-mono text-sm tabular-nums text-(--ink-3) shrink-0 flex items-center gap-2 whitespace-nowrap ${labelWidth}`}
      >
        <ColorDot color={color} />
        {label}
      </span>
      <div className="flex-1 h-6 bg-(--card-2) rounded overflow-hidden">
        <div
          className="h-full rounded transition-all duration-300"
          style={{
            width: `${Math.max(pct, active ? 2 : 0)}%`,
            background: color,
            opacity: active ? 0.7 : 0,
          }}
        />
      </div>
      <span
        className={`font-mono text-sm tabular-nums text-(--ink-3) text-right shrink-0 ${rightWidth}`}
      >
        {rightLabel}
      </span>
    </div>
  )
}
