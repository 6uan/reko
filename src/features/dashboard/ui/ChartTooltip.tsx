/**
 * Wrapper for Recharts custom tooltips. Usage:
 *
 *   function MyTooltip({ active, payload }: TooltipProps) {
 *     if (!active || !payload?.[0]) return null
 *     return (
 *       <ChartTooltip>
 *         <div>…formatted payload…</div>
 *       </ChartTooltip>
 *     )
 *   }
 */

import type { ReactNode } from 'react'

export default function ChartTooltip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-(--card) border border-(--line) rounded-lg shadow-(--shadow-m) px-3 py-2.5 text-sm">
      {children}
    </div>
  )
}
