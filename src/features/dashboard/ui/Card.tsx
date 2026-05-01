/**
 * Card surface — the bordered, rounded container used everywhere on the
 * dashboard. Padding and overflow vary by context, so they're passed via
 * `className` rather than baked in.
 *
 *   <Card className="p-4">…chart…</Card>
 *   <Card className="overflow-hidden">…table…</Card>
 *   <Card className="p-5">…hero…</Card>
 */

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export default function Card({ children, className = '' }: Props) {
  return (
    <div
      className={`bg-(--card) border border-(--line) rounded-(--radius-m) ${className}`.trim()}
    >
      {children}
    </div>
  )
}
