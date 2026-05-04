/**
 * Recharts tooltip utilities.
 *
 * `ChartTooltip` — styled wrapper (card with border + shadow).
 * `makeTooltip` — factory that handles the active/payload guard so
 *   consumers only provide the render function for the data payload.
 *
 * Usage:
 *
 *   const MyTooltip = makeTooltip<{ week: string; avg: number }>((d) => (
 *     <p>{d.week}: {d.avg}</p>
 *   ))
 *
 *   <Tooltip content={<MyTooltip />} />
 */

import type { ReactNode } from 'react'

export default function ChartTooltip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-(--card) border border-(--line) rounded-(--radius-s) shadow-(--shadow-m) px-3 py-2.5 text-sm">
      {children}
    </div>
  )
}

/**
 * Factory that creates a Recharts-compatible tooltip component.
 * Handles the `active`/`payload` guard internally — you just render the data.
 */
export function makeTooltip<T>(render: (data: T) => ReactNode) {
  return function Tooltip({
    active,
    payload,
  }: {
    active?: boolean
    payload?: Array<{ payload: T }>
  }) {
    if (!active || !payload?.[0]) return null
    return (
      <ChartTooltip>{render(payload[0].payload)}</ChartTooltip>
    )
  }
}
