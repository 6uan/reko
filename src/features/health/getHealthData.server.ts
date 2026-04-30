/**
 * Health / diagnostics data loader (SERVER ONLY).
 *
 * Aggregates system health info for the profile page's Advanced section.
 * Designed to answer three user-facing questions:
 *   1. "Is my Strava connection healthy?"
 *   2. "Is my data complete?"
 *   3. "What synced recently?"
 *
 * Not a server fn itself — designed to be called from inside a route
 * loader that has already authenticated the user.
 */

import { and, count, desc, eq, gte, isNotNull, or } from 'drizzle-orm'
import { getDb } from '../../db/client'
import { activities, syncLog, tokens } from '../../db/schema'

export type RecentSync = {
  id: number
  /** Human-readable description, e.g. "Synced 47 runs" or "New run added" */
  label: string
  status: 'success' | 'error' | 'running' | 'rate_limited'
  finishedAt: string | null
  startedAt: string
  error: string | null
}

export type HealthData = {
  /** Overall status: 'healthy' | 'degraded' | 'error' */
  overallStatus: 'healthy' | 'degraded' | 'error'
  /** Short explanation of status */
  statusReason: string
  /** ISO string of last successful sync */
  lastSyncAt: string | null
  /** Total activities (all types) in DB for this user. */
  totalActivities: number
  /** Total runs specifically. */
  totalRuns: number
  /** Activities that have had detail + streams fetched. */
  detailSynced: number
  /** Percentage of activities with full detail. */
  detailCoveragePct: number
  /** Whether the token can auto-refresh (not revoked). */
  tokenHealthy: boolean
  /** Recent sync events in plain language (newest first). */
  recentSyncs: RecentSync[]
}

export async function getHealthData(
  userId: number,
): Promise<HealthData> {
  const db = getDb()

  const [
    recentSyncRows,
    totalResult,
    runResult,
    detailResult,
    tokenRow,
  ] = await Promise.all([
    // Last 5 sync_log entries (backfill only — detail fetches are invisible plumbing).
    db
      .select({
        id: syncLog.id,
        kind: syncLog.kind,
        status: syncLog.status,
        startedAt: syncLog.startedAt,
        finishedAt: syncLog.finishedAt,
        error: syncLog.error,
      })
      .from(syncLog)
      .where(and(eq(syncLog.userId, userId), eq(syncLog.kind, 'backfill')))
      .orderBy(desc(syncLog.startedAt))
      .limit(5),

    // Total activities (all types).
    db
      .select({ value: count() })
      .from(activities)
      .where(eq(activities.userId, userId)),

    // Total runs specifically.
    db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          or(eq(activities.type, 'Run'), eq(activities.sportType, 'Run')),
        ),
      ),

    // Detail-synced activities.
    db
      .select({ value: count() })
      .from(activities)
      .where(
        and(
          eq(activities.userId, userId),
          isNotNull(activities.detailSyncedAt),
        ),
      ),

    // Token health — just check if it exists and isn't ancient.
    db
      .select({
        expiresAt: tokens.expiresAt,
        updatedAt: tokens.updatedAt,
      })
      .from(tokens)
      .where(eq(tokens.userId, userId))
      .limit(1),
  ])

  const total = totalResult[0]?.value ?? 0
  const runs = runResult[0]?.value ?? 0
  const detail = detailResult[0]?.value ?? 0
  const token = tokenRow[0]

  const detailCoveragePct =
    total > 0 ? Math.round((detail / total) * 100) : 0

  // Token is healthy if it exists and was refreshed in the last 30 days.
  // The auto-refresh mechanism handles expiry silently — we only flag
  // tokens that haven't been touched in a month (likely revoked).
  const tokenHealthy = token?.updatedAt
    ? Date.now() - token.updatedAt.getTime() < 30 * 24 * 60 * 60 * 1000
    : false

  // For each sync, count how many activities were synced during that window.
  const recentSyncs: RecentSync[] = await Promise.all(
    recentSyncRows.map(async (row) => {
      // Count activities whose syncedAt falls within this sync's window.
      let activitiesSynced = 0
      if (row.finishedAt) {
        const [result] = await db
          .select({ value: count() })
          .from(activities)
          .where(
            and(
              eq(activities.userId, userId),
              gte(activities.syncedAt, row.startedAt),
              // Use finishedAt + 1s buffer for timing edge cases.
              or(
                eq(activities.type, 'Run'),
                eq(activities.sportType, 'Run'),
              ),
            ),
          )
        activitiesSynced = result?.value ?? 0
      }

      const label =
        row.status === 'running'
          ? 'Syncing...'
          : row.status === 'error'
            ? 'Sync failed'
            : row.status === 'rate_limited'
              ? 'Strava rate limit hit'
              : activitiesSynced > 0
                ? `Synced ${activitiesSynced} ${activitiesSynced === 1 ? 'run' : 'runs'}`
                : 'Sync completed — no new runs'

      return {
        id: row.id,
        label,
        status: row.status as RecentSync['status'],
        finishedAt: row.finishedAt?.toISOString() ?? null,
        startedAt: row.startedAt.toISOString(),
        error: row.error,
      }
    }),
  )

  // Derive overall status from recent sync health.
  const lastSync = recentSyncRows[0]
  let overallStatus: HealthData['overallStatus'] = 'healthy'
  let statusReason = 'All systems working'

  if (!lastSync) {
    overallStatus = 'degraded'
    statusReason = 'No syncs yet — run your first sync from the dashboard'
  } else if (lastSync.status === 'error') {
    overallStatus = 'error'
    statusReason = lastSync.error ?? 'Last sync failed'
  } else if (lastSync.status === 'rate_limited') {
    overallStatus = 'degraded'
    statusReason = 'Strava rate limit hit — will retry automatically'
  } else if (lastSync.status === 'running') {
    overallStatus = 'healthy'
    statusReason = 'Sync in progress'
  } else if (!tokenHealthy) {
    overallStatus = 'degraded'
    statusReason = 'Strava connection may need re-authorization'
  }

  return {
    overallStatus,
    statusReason,
    lastSyncAt: lastSync?.finishedAt?.toISOString() ?? null,
    totalActivities: total,
    totalRuns: runs,
    detailSynced: detail,
    detailCoveragePct,
    tokenHealthy,
    recentSyncs,
  }
}
