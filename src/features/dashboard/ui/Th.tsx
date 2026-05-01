/**
 * Table column header. Bakes in the eyebrow typography (uppercase mono
 * tracked muted) so column headers stay consistent across tabs.
 *
 * Padding/alignment vary by table — pass via `className`.
 *   <Th>Activity</Th>                       // px-3 text-left default
 *   <Th className="px-4">Date</Th>          // override padding
 *   <Th className="text-right">Runs</Th>    // override align
 */

import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
}

export default function Th({ children, className = 'px-3 text-left' }: Props) {
  return (
    <th
      className={`bg-(--card-2) text-eyebrow font-medium py-2.5 ${className}`}
    >
      {children}
    </th>
  )
}
