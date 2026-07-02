/**
 * Landing-hero CTA: logs the visitor into the default demo persona
 * (read-only seeded session) and hard-navigates to the dashboard.
 * Shows "unavailable" if this instance has no seeded demo data —
 * self-hosters who haven't run scripts/seed-demo.ts.
 */

import { useState } from 'react'
import { LuPlay } from 'react-icons/lu'
import { startDemoSession } from '@/features/auth/session'
import { cn } from '@/lib/cn'

export default function TryDemoButton({ className }: { className?: string }) {
  const [state, setState] = useState<'idle' | 'pending' | 'unavailable'>('idle')

  async function handleClick() {
    if (state !== 'idle') return
    setState('pending')
    try {
      const session = await startDemoSession({ data: {} })
      if (session) {
        window.location.assign('/dashboard')
        return
      }
      setState('unavailable')
    } catch (err) {
      console.error('[demo] start failed:', err)
      setState('unavailable')
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
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
