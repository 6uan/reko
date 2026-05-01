/**
 * Last sync timestamp loader (SERVER ONLY).
 *
 * Returns the most recent sync's `finishedAt` as an ISO string, or
 * null when no sync has ever completed (or the latest is still running).
 * Used by the dashboard loader to seed the ResyncButton's cooldown ring
 * on page load so the button is correctly disabled if the user refreshes
 * within the cooldown window.
 *
 * Not a server fn itself — designed to be called from inside the
 * dashboard's `loadDashboardData` handler, which already authenticates.
 *
 * IMPORTANT: this module imports `pg` (via `getDb`). Do NOT import it
 * from any client component.
 */

import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { syncLog } from '@/db/schema'

export async function getLastSyncTime(
  userId: number,
): Promise<string | null> {
  const db = getDb()

  const [latestSync] = await db
    .select({ finishedAt: syncLog.finishedAt })
    .from(syncLog)
    .where(eq(syncLog.userId, userId))
    .orderBy(desc(syncLog.startedAt))
    .limit(1)

  return latestSync?.finishedAt?.toISOString() ?? null
}
