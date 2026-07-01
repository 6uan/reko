/**
 * Server fn the landing route's loader calls to feed the StatsStrip.
 *
 * Both stats degrade to `null` (rendered as a dash) rather than failing
 * the loader — the landing page must never 500 because GitHub or the
 * database is unreachable.
 */

import { createServerFn } from '@tanstack/react-start'
import { count } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities } from '@/db/schema'
import { fetchGithubStarsCached } from '@/features/landing/getGithubStars'

export type LandingStats = {
  githubStars: number | null
  activitiesTracked: number | null
}

async function countActivities(): Promise<number | null> {
  try {
    const db = getDb()
    const [{ value }] = await db.select({ value: count() }).from(activities)
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
