import { createServerFn } from '@tanstack/react-start'
// `@tanstack/react-start/server` is server-only, but this module is reachable
// from the client (__root.tsx imports `getSession`). Importing it at the top
// level leaks it into the client bundle, so each server-only function below
// imports it dynamically instead — same pattern as the DB imports in
// getDevBypassSession.

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
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

/**
 * Cookie-session config, built lazily so the SESSION_SECRET check runs only on
 * the server. This module is in the client graph (__root.tsx imports
 * `getSession`), where env vars are undefined — asserting at module top level
 * would crash the browser bundle, and a missing secret would otherwise
 * silently disable cookie encryption. Every caller below is server-only.
 */
function serverSessionConfig() {
  const password = process.env.SESSION_SECRET
  if (!password) {
    throw new Error('SESSION_SECRET is not set — refusing to read/write sessions')
  }
  return { password, name: 'reko', maxAge: SESSION_MAX_AGE }
}

// ── Dev auth bypass ────────────────────────────────────────────────
/**
 * When DEV_AUTH_BYPASS=true, skip OAuth and auto-login as user 1.
 * Useful for testing in tools like Responsively where you can't
 * complete the Strava OAuth flow.
 */
async function getDevBypassSession(): Promise<SessionData | null> {
  try {
    // Never allow the auth bypass in production, whatever the env says.
    if (process.env.NODE_ENV === 'production') return null
    if (process.env.DEV_AUTH_BYPASS !== 'true') return null

    const { getDb } = await import('@/db/client')
    const { users, tokens } = await import('@/db/schema')
    const { eq } = await import('drizzle-orm')

    const db = getDb()
    const DEV_USER_ID = Number(process.env.DEV_USER_ID ?? 1)

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, DEV_USER_ID))
      .limit(1)
    if (!user) return null

    const [token] = await db
      .select()
      .from(tokens)
      .where(eq(tokens.userId, DEV_USER_ID))
      .limit(1)

    return {
      userId: user.id,
      accessToken: token?.accessToken ?? 'dev-bypass',
      refreshToken: token?.refreshToken ?? 'dev-bypass',
      expiresAt: token ? Math.floor(token.expiresAt.getTime() / 1000) : Date.now() + 86400,
      athleteId: user.stravaAthleteId,
      firstname: user.firstname ?? 'Dev',
      lastname: user.lastname ?? 'User',
      profile: user.profileUrl ?? 'avatar/athlete/large.png',
    }
  } catch (err) {
    console.error('[dev-bypass] failed:', err)
    return null
  }
}

// ── Server-side session reader (for use inside other server fns) ──
/**
 * Plain async function for server-side callers that already run on
 * the server (e.g. loaders, other createServerFn handlers). Includes
 * the dev bypass so every call site gets it for free.
 */
export async function readSessionOnServer(): Promise<SessionData | null> {
  const devSession = await getDevBypassSession()
  if (devSession) return devSession

  const { getSession: frameworkGetSession } = await import(
    '@tanstack/react-start/server'
  )
  const session = await frameworkGetSession<SessionData>(serverSessionConfig())
  const d = session.data
  if (!d.accessToken || !d.athleteId) return null
  return d as SessionData
}

// ── Server functions ───────────────────────────────────────────────

/** Read the current session (returns null if not logged in) */
export const getSession = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionData | null> => readSessionOnServer(),
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
    const { updateSession } = await import('@tanstack/react-start/server')
    await updateSession<SessionData>(serverSessionConfig(), data)
  })

/** Clear the session (logout) */
export const clearSessionFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    const { clearSession } = await import('@tanstack/react-start/server')
    await clearSession(serverSessionConfig())
  },
)
