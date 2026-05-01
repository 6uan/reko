/**
 * Centered placeholder for "no data" inside a chart container.
 */

import type { ReactNode } from 'react'

export default function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center">
      <span className="text-sm text-(--ink-4)">{children}</span>
    </div>
  )
}
