/**
 * Fetch + upsert every gear item (shoe / bike) referenced by the user's
 * activities. Read-only mirror of Strava's gear — the API has no gear write
 * endpoint. Cheap (a user has a handful of gear, 1 call each) and idempotent;
 * skips gracefully on a 429 and finishes on the next sync.
 */

import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities, gear } from '@/db/schema'
import { fetchGear, StravaRateLimitedError } from '@/lib/strava'
import { withFreshToken } from './withFreshToken.server'

export async function syncGear(userId: number): Promise<number> {
  const db = getDb()

  const rows = await db
    .selectDistinct({ gearId: activities.gearId })
    .from(activities)
    .where(and(eq(activities.userId, userId), isNotNull(activities.gearId)))

  const gearIds = rows
    .map((r) => r.gearId)
    .filter((g): g is string => !!g)
  if (gearIds.length === 0) return 0

  const accessToken = await withFreshToken(userId)
  let synced = 0

  for (const gearId of gearIds) {
    try {
      const g = await fetchGear(accessToken, gearId)
      await db
        .insert(gear)
        .values({
          id: g.id,
          userId,
          name: g.name,
          nickname: g.nickname ?? null,
          brandName: g.brand_name ?? null,
          modelName: g.model_name ?? null,
          isPrimary: g.primary ?? false,
          retired: g.retired ?? false,
          distance: g.distance ?? 0,
          fetchedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: gear.id,
          set: {
            name: sql`excluded.name`,
            nickname: sql`excluded.nickname`,
            brandName: sql`excluded.brand_name`,
            modelName: sql`excluded.model_name`,
            isPrimary: sql`excluded.is_primary`,
            retired: sql`excluded.retired`,
            distance: sql`excluded.distance`,
            fetchedAt: sql`now()`,
          },
        })
      synced++
    } catch (err) {
      if (err instanceof StravaRateLimitedError) {
        console.warn(
          `[gear] rate limited for user ${userId} (${synced}/${gearIds.length} done) — finishing next sync`,
        )
        break
      }
      console.error(`[gear] failed to sync ${gearId}:`, err)
    }
  }

  console.log(`[gear] synced ${synced} gear items for user ${userId}`)
  return synced
}
