/**
 * Persist Strava OAuth result to the DB.
 *
 * Called from the OAuth callback (server-only). Idempotent: safe to call
 * on every login. Handles both first-login (insert) and subsequent
 * logins (update tokens + refresh profile).
 *
 * The session cookie still holds tokens for fast read paths, but the
 * source of truth for background workers (sync, webhooks) is the DB —
 * background code has no access to the request's session cookie.
 */

import { getDb } from '../../db/client'
import { tokens, users } from '../../db/schema'

/** Subset of Strava's `/oauth/token` response we actually use. */
export type StravaTokenExchange = {
  access_token: string
  refresh_token: string
  expires_at: number // unix seconds
  athlete: {
    id: number
    firstname: string
    lastname: string
    profile: string
  }
}

/**
 * Upsert the athlete + their OAuth tokens.
 * Returns the internal `users.id` (NOT the Strava athlete id) — this is
 * what every other table references via FK.
 */
export async function persistAthlete(
  exchange: StravaTokenExchange,
): Promise<number> {
  const db = getDb()
  const expiresAt = new Date(exchange.expires_at * 1000)

  // Upsert user — keyed by Strava athlete id, returns our internal serial id.
  const [{ id: userId }] = await db
    .insert(users)
    .values({
      stravaAthleteId: exchange.athlete.id,
      firstname: exchange.athlete.firstname,
      lastname: exchange.athlete.lastname,
      profileUrl: exchange.athlete.profile,
    })
    .onConflictDoUpdate({
      target: users.stravaAthleteId,
      set: {
        firstname: exchange.athlete.firstname,
        lastname: exchange.athlete.lastname,
        profileUrl: exchange.athlete.profile,
      },
    })
    .returning({ id: users.id })

  // Upsert tokens — PK is user_id, so 1:1.
  await db
    .insert(tokens)
    .values({
      userId,
      accessToken: exchange.access_token,
      refreshToken: exchange.refresh_token,
      expiresAt,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: tokens.userId,
      set: {
        accessToken: exchange.access_token,
        refreshToken: exchange.refresh_token,
        expiresAt,
        updatedAt: new Date(),
      },
    })

  return userId
}
