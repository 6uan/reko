/**
 * Thin strip above the dashboard topbar for demo sessions: labels the
 * data as synthetic, switches personas, and exits to the landing page.
 * Mounts where SyncBanner normally lives — demo sessions never sync.
 *
 * Persona switches and exits do a full navigation on purpose: the
 * dashboard loader caches with staleTime: Infinity, and a hard load is
 * the reliable way to drop every cache tied to the previous persona.
 */

import { useState } from 'react'
import { clearSessionFn, startDemoSession } from '@/features/auth/session'
import { DEMO_PERSONAS, type DemoPersonaKey } from '@/features/demo/constants'
import { cn } from '@/lib/cn'

type Props = {
  /** Session athleteId — identifies which persona is active. */
  athleteId: number
}

export default function DemoBanner({ athleteId }: Props) {
  const [busy, setBusy] = useState(false)
  const active = DEMO_PERSONAS.find((p) => p.athleteId === athleteId)

  async function switchPersona(persona: DemoPersonaKey) {
    if (busy || persona === active?.key) return
    setBusy(true)
    try {
      const session = await startDemoSession({ data: { persona } })
      if (session) {
        window.location.assign('/dashboard')
        return
      }
    } catch (err) {
      console.error('[demo] persona switch failed:', err)
    }
    setBusy(false)
  }

  async function exitDemo() {
    if (busy) return
    setBusy(true)
    try {
      await clearSessionFn()
      window.location.assign('/')
      return
    } catch (err) {
      console.error('[demo] exit failed:', err)
    }
    setBusy(false)
  }

  return (
    <div className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-(--line) bg-(--bg-2) px-4 py-2 lg:px-6">
      <span className="rounded-full bg-(--accent-soft) px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-(--accent)">
        Demo
      </span>
      <span className="text-xs text-(--ink-3) max-sm:hidden">
        Synthetic data · viewing as
      </span>
      <div className="flex items-center gap-1" role="group" aria-label="Demo persona">
        {DEMO_PERSONAS.map((p) => (
          <button
            key={p.key}
            type="button"
            disabled={busy}
            onClick={() => switchPersona(p.key)}
            title={p.blurb}
            className={cn(
              'cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition-colors disabled:opacity-50',
              p.key === active?.key
                ? 'border-(--accent) bg-(--accent-soft) font-medium text-(--ink)'
                : 'border-(--line) bg-(--card) text-(--ink-3) hover:text-(--ink)',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={exitDemo}
        disabled={busy}
        className="ml-auto cursor-pointer text-xs text-(--ink-3) underline-offset-2 hover:text-(--ink) hover:underline disabled:opacity-50"
      >
        Exit demo
      </button>
    </div>
  )
}
