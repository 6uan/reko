/**
 * Get a guaranteed-fresh Strava access token for a user, by reading
 * tokens from the DB and refreshing if within 5 min of expiry.
 *
 * This is the BACKGROUND-SAFE version (read tokens from DB, not session
 * cookie). The dashboard's request-time path still refreshes via the
 * session; both eventually write back to the DB.
 */

import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { tokens } from '../../db/schema'
import { refreshAccessToken } from '../../lib/strava'

const REFRESH_BUFFER_SECONDS = 300 // 5 min

export async function withFreshToken(userId: number): Promise<string> {
  const db = getDb()

  const [row] = await db
    .select()
    .from(tokens)
    .where(eq(tokens.userId, userId))
    .limit(1)

  if (!row) {
    throw new Error(
      `No tokens found for user ${userId}. Did they finish OAuth?`,
    )
  }

  const expiresAtSeconds = Math.floor(row.expiresAt.getTime() / 1000)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const isExpiring = expiresAtSeconds < nowSeconds + REFRESH_BUFFER_SECONDS

  if (!isExpiring) {
    return row.accessToken
  }

  // Refresh and persist
  const refreshed = await refreshAccessToken(row.refreshToken)

  await db
    .update(tokens)
    .set({
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      expiresAt: new Date(refreshed.expires_at * 1000),
      updatedAt: new Date(),
    })
    .where(eq(tokens.userId, userId))

  return refreshed.access_token
}
