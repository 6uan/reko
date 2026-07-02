/**
 * Server-only session internals. Never import this from client-reachable
 * code — the exported server fns in ./session.ts are the client bridge.
 * (Feature files may import it for use *inside* createServerFn handlers;
 * the Start compiler strips those from client bundles.)
 *
 * This split exists because session.ts is in the client graph via
 * __root.tsx, and keeping `@tanstack/react-start/server` imports there —
 * even dynamic ones — tripped the import-protection warning on every
 * dev restart.
 */

import {
  getSession as frameworkGetSession,
  updateSession,
  clearSession,
} from '@tanstack/react-start/server'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { users, tokens } from '@/db/schema'
import {
  DEMO_PERSONAS,
  type DemoPersonaKey,
} from '@/features/demo/constants'
import type { SessionData } from '@/features/auth/session'

const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export function serverSessionConfig() {
  const password = process.env.SESSION_SECRET
  if (!password) {
    throw new Error('SESSION_SECRET is not set — refusing to read/write sessions')
  }
  return { password, name: 'reko', maxAge: SESSION_MAX_AGE }
}

// ── Dev auth bypass ────────────────────────────────────────────────
/**
 * When DEV_AUTH_BYPASS=true, skip OAuth and auto-login as DEV_USER_ID.
 * Useful for testing in tools like Responsively where you can't
 * complete the Strava OAuth flow. Carries the user's demo flag so
 * demo-mode guards and UI behave the same under the bypass.
 */
async function getDevBypassSession(): Promise<SessionData | null> {
  try {
    // Never allow the auth bypass in production, whatever the env says.
    if (process.env.NODE_ENV === 'production') return null
    if (process.env.DEV_AUTH_BYPASS !== 'true') return null

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
      demo: user.demo,
    }
  } catch (err) {
    console.error('[dev-bypass] failed:', err)
    return null
  }
}

// ── Session readers ────────────────────────────────────────────────

/**
 * Plain async function for server-side callers that already run on
 * the server (loaders, other createServerFn handlers). Includes the
 * dev bypass so every call site gets it for free.
 */
export async function readSessionOnServer(): Promise<SessionData | null> {
  const devSession = await getDevBypassSession()
  if (devSession) return devSession

  const session = await frameworkGetSession<SessionData>(serverSessionConfig())
  const d = session.data
  if (!d.accessToken || !d.athleteId) return null
  return d as SessionData
}

/**
 * Session reader for MUTATING server fns. Demo sessions are read-only
 * by contract: every write path must go through this (or check `demo`
 * itself) so the guarantee holds server-side, not just in hidden UI.
 */
export async function requireWritableSession(): Promise<SessionData> {
  const session = await readSessionOnServer()
  if (!session) throw new Error('Not authenticated')
  if (session.demo) throw new Error('Demo sessions are read-only')
  return session
}

// ── Demo sessions ──────────────────────────────────────────────────

/**
 * Log the visitor in as a seeded demo persona. Production-safe by
 * construction: the input is a persona key (never a raw user id), the
 * lookup is by the persona's fixed Strava athlete id AND requires
 * users.demo = true, and the stored tokens are inert placeholders.
 * Returns null when the demo data isn't seeded on this instance.
 */
export async function startDemoSessionOnServer(
  personaKey: DemoPersonaKey,
): Promise<SessionData | null> {
  const persona = DEMO_PERSONAS.find((p) => p.key === personaKey)
  if (!persona) return null

  const db = getDb()
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(eq(users.stravaAthleteId, persona.athleteId), eq(users.demo, true)),
    )
    .limit(1)
  if (!user) return null

  const session: SessionData = {
    userId: user.id,
    accessToken: 'demo',
    refreshToken: 'demo',
    // Far future — nothing may refresh a demo "token", and the guards
    // keep demo sessions away from every Strava call anyway.
    expiresAt: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    athleteId: user.stravaAthleteId,
    firstname: user.firstname ?? 'Demo',
    lastname: user.lastname ?? 'Runner',
    profile: user.profileUrl ?? '',
    demo: true,
  }
  await updateSession<SessionData>(serverSessionConfig(), session)
  return session
}

export async function clearSessionOnServer(): Promise<void> {
  await clearSession(serverSessionConfig())
}

export async function writeSessionOnServer(data: SessionData): Promise<void> {
  await updateSession<SessionData>(serverSessionConfig(), data)
}
