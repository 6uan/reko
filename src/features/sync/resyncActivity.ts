/**
 * Server fn: pull Strava detail (best_efforts + streams + rich fields) for a
 * SINGLE activity on demand. Powers the "Sync this activity" button on the
 * detail page — a targeted alternative to the all-or-nothing backfill/resync,
 * and the one-click fix for an activity stuck without stream data.
 */

import { createServerFn } from '@tanstack/react-start'
import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities } from '@/db/schema'
import { publish } from '@/lib/eventBus'
import { StravaRateLimitedError } from '@/lib/strava'
import { readSessionOnServer } from '@/features/auth/session'
import { storeActivityDetail } from './api/storeActivityDetail.server'
import { withFreshToken } from './api/withFreshToken.server'

export type ResyncActivityResult =
  | { ok: true; streamCount: number; bestEffortCount: number }
  | {
      ok: false
      reason: 'rate_limited' | 'not_found' | 'unauthenticated' | 'error'
      message: string
    }

export const resyncActivity = createServerFn({ method: 'POST' })
  .inputValidator((activityId: number) => activityId)
  .handler(async ({ data: activityId }): Promise<ResyncActivityResult> => {
    const session = await readSessionOnServer()
    if (!session?.userId) {
      return { ok: false, reason: 'unauthenticated', message: 'Not signed in.' }
    }
    const userId = session.userId
    const db = getDb()

    // Ownership gate — never fetch an activity the session user doesn't own.
    const [row] = await db
      .select({ id: activities.id })
      .from(activities)
      .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
      .limit(1)
    if (!row) {
      return { ok: false, reason: 'not_found', message: 'Activity not found.' }
    }

    try {
      const accessToken = await withFreshToken(userId)
      const result = await storeActivityDetail(accessToken, userId, activityId)
      // storeActivityDetail intentionally leaves detailSyncedAt alone (the
      // worker owns it); stamp it here so the activity leaves the NULL queue.
      await db
        .update(activities)
        .set({ detailSyncedAt: new Date() })
        .where(eq(activities.id, activityId))
      publish(userId, { type: 'activity-changed', reason: 'detail-worker' })
      return {
        ok: true,
        streamCount: result.streamCount,
        bestEffortCount: result.bestEffortCount,
      }
    } catch (err) {
      if (err instanceof StravaRateLimitedError) {
        return {
          ok: false,
          reason: 'rate_limited',
          message: 'Strava rate limit hit — try again in a few minutes.',
        }
      }
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[resyncActivity] failed for ${activityId}:`, err)
      return { ok: false, reason: 'error', message }
    }
  })
