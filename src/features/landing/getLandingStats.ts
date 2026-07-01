/**
 * Server fn the landing route's loader calls to feed the StatsStrip.
 *
 * Both stats degrade to `null` (rendered as a dash) rather than failing
 * the loader — the landing page must never 500 because GitHub or the
 * database is unreachable.
 */

import { createServerFn } from '@tanstack/react-start'
import { count, eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities, users } from '@/db/schema'
import { fetchGithubStarsCached } from '@/features/landing/getGithubStars'

export type LandingStats = {
  githubStars: number | null
  activitiesTracked: number | null
}

async function countActivities(): Promise<number | null> {
  try {
    const db = getDb()
    // Demo personas are seed data, not usage — keep the public number honest.
    const [{ value }] = await db
      .select({ value: count() })
      .from(activities)
      .innerJoin(users, eq(activities.userId, users.id))
      .where(eq(users.demo, false))
    return value
  } catch {
    return null
  }
}

export const getLandingStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<LandingStats> => {
    const [githubStars, activitiesTracked] = await Promise.all([
      fetchGithubStarsCached(),
      countActivities(),
    ])
    return { githubStars, activitiesTracked }
  },
)
