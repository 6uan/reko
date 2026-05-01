/**
 * Server fn the dashboard's SyncBanner polls every 2s while a backfill
 * is in flight.
 *
 * Returns:
 *   - the latest sync_log row's status (or 'idle' if no rows exist)
 *   - the current run count in DB so the banner can compare against
 *     the count the dashboard loader returned (and decide to invalidate)
 */

import { createServerFn } from '@tanstack/react-start'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import { and, count, desc, eq, or } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities, syncLog } from '@/db/schema'
import { sessionConfig, type SessionData } from '@/features/auth/session'

export type SyncStatusValue =
  | 'idle'
  | 'running'
  | 'success'
  | 'error'
  | 'rate_limited'

export type SyncStatus = {
  status: SyncStatusValue
  /** Number of *Run-type* activities in DB for this user. */
  runCount: number
  /** From the latest sync_log row. */
  pagesFetched: number
  startedAt: string | null
  finishedAt: string | null
  error: string | null
}

export const getSyncStatus = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SyncStatus> => {
    const session = await frameworkGetSession<SessionData>(sessionConfig)
    const userId = session.data.userId

    if (!userId) {
      return {
        status: 'idle',
        runCount: 0,
        pagesFetched: 0,
        startedAt: null,
        finishedAt: null,
        error: null,
      }
    }

    const db = getDb()

    // Filtered to kind='backfill' so the SyncBanner only ever reflects
    // summary backfills. The detail-fetch worker also writes sync_log
    // rows (kind='detail') but runs invisibly in the background — its
    // status would otherwise leak into the banner and confuse the user.
    const [latest] = await db
      .select()
      .from(syncLog)
      .where(and(eq(syncLog.userId, userId), eq(syncLog.kind, 'backfill')))
      .orderBy(desc(syncLog.startedAt))
      .limit(1)

    const [{ value: runCount }] = await db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          or(eq(activities.type, 'Run'), eq(activities.sportType, 'Run')),
        ),
      )

    return {
      status: latest?.status ?? 'idle',
      runCount,
      pagesFetched: latest?.callsUsed ?? 0,
      startedAt: latest?.startedAt.toISOString() ?? null,
      finishedAt: latest?.finishedAt?.toISOString() ?? null,
      error: latest?.error ?? null,
    }
  },
)
