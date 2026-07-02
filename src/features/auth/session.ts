/**
 * Client-safe session surface: the SessionData type and the server fns
 * the client calls over RPC. Everything that touches
 * `@tanstack/react-start/server`, the DB, or env vars lives in
 * ./session.server.ts — this module is in the client graph via
 * __root.tsx, and server-only imports here (even dynamic) trip the
 * bundler's import protection.
 */

import { createServerFn } from '@tanstack/react-start'
import {
  DEFAULT_DEMO_PERSONA,
  DEMO_PERSONAS,
  type DemoPersonaKey,
} from '@/features/demo/constants'

// ── Types ──────────────────────────────────────────────────────────
export type SessionData = {
  /** Internal users.id — required for DB queries (joins, sync attribution). */
  userId: number
  accessToken: string
  refreshToken: string
  expiresAt: number
  athleteId: number
  firstname: string
  lastname: string
  profile: string
  /**
   * Read-only demo persona session ("Try the demo"). Mutating server
   * fns reject it (session.server.ts requireWritableSession); sync and
   * account UI hides behind it.
   */
  demo?: boolean
}

// ── Server functions (client-callable RPC bridges) ─────────────────

/** Read the current session (returns null if not logged in) */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionData | null> => {
    const { readSessionOnServer } = await import(
      '@/features/auth/session.server'
    )
    return readSessionOnServer()
  },
)

/** Store Strava token data into the encrypted session cookie */
export const setSession = createServerFn({ method: 'POST' })
  .inputValidator(
    (data: {
      userId: number
      accessToken: string
      refreshToken: string
      expiresAt: number
      athleteId: number
      firstname: string
      lastname: string
      profile: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const { writeSessionOnServer } = await import(
      '@/features/auth/session.server'
    )
    // demo: false explicitly — session updates merge, and a real OAuth
    // login must never inherit a leftover demo flag from a prior
    // "Try the demo" cookie.
    await writeSessionOnServer({ ...data, demo: false })
  })

/**
 * Log in as a seeded demo persona (read-only session). Returns the
 * session, or null when demo data isn't seeded on this instance.
 */
export const startDemoSession = createServerFn({ method: 'POST' })
  .inputValidator((data: { persona?: DemoPersonaKey } | undefined) => {
    const persona = data?.persona ?? DEFAULT_DEMO_PERSONA
    if (!DEMO_PERSONAS.some((p) => p.key === persona)) {
      throw new Error(`Unknown demo persona: ${String(persona)}`)
    }
    return { persona }
  })
  .handler(async ({ data }): Promise<SessionData | null> => {
    const { startDemoSessionOnServer } = await import(
      '@/features/auth/session.server'
    )
    return startDemoSessionOnServer(data.persona)
  })

/** Clear the session (logout / exit demo) */
export const clearSessionFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { clearSessionOnServer } = await import(
      '@/features/auth/session.server'
    )
    await clearSessionOnServer()
  },
)
