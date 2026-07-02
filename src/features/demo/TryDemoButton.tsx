/**
 * Landing-hero CTA: logs the visitor into the default demo persona
 * (read-only seeded session) and hard-navigates to the dashboard.
 * Shows "unavailable" if this instance has no seeded demo data —
 * self-hosters who haven't run scripts/seed-demo.ts.
 */

import { LuPlay } from 'react-icons/lu'
import { useLaunchDemo } from '@/features/demo/useLaunchDemo'
import { cn } from '@/lib/cn'

export default function TryDemoButton({ className }: { className?: string }) {
  const { state, launch } = useLaunchDemo()

  return (
    <button
      type="button"
      onClick={launch}
      disabled={state !== 'idle'}
      className={cn('btn btn-ghost', className)}
    >
      <LuPlay size={18} />
      {state === 'pending'
        ? 'Loading demo…'
        : state === 'unavailable'
          ? 'Demo unavailable'
          : 'Try the demo'}
    </button>
  )
}
