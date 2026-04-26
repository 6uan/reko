import { createServerFn } from '@tanstack/react-start'
import {
  getSession as frameworkGetSession,
  updateSession as frameworkUpdateSession,
  clearSession as frameworkClearSession,
} from '@tanstack/react-start/server'

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
}

// ── Config ─────────────────────────────────────────────────────────
export const sessionConfig = {
  password: process.env.SESSION_SECRET!,
  name: 'reko',
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

// ── Server functions ───────────────────────────────────────────────

/** Read the current session (returns null if not logged in) */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionData | null> => {
    const session = await frameworkGetSession<SessionData>(sessionConfig)
    const d = session.data
    if (!d.accessToken || !d.athleteId) return null
    return d as SessionData
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
    await frameworkUpdateSession<SessionData>(sessionConfig, data)
  })

/** Clear the session (logout) */
export const clearSessionFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    await frameworkClearSession(sessionConfig)
  },
)
