/**
 * Shared launcher for demo entry points (hero button, mockup overlay):
 * starts the default demo persona server-side, then hard-navigates to
 * the dashboard. 'unavailable' = this instance has no seeded demo data.
 */

import { useState } from 'react'
import { startDemoSession } from '@/features/auth/session'

export type DemoLaunchState = 'idle' | 'pending' | 'unavailable'

export function useLaunchDemo() {
  const [state, setState] = useState<DemoLaunchState>('idle')

  async function launch() {
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

  return { state, launch }
}
