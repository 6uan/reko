/**
 * Manual test for the detail-fetch worker — Chunk 1.2.b verification.
 *
 * Calls enqueueDetailFetch(userId), then polls sync_log every 2s and
 * prints progress until the run finishes.
 *
 * Useful because:
 *   - bypasses the 5min resync cooldown (no waiting between iterations)
 *   - --reset re-fetches every activity (test idempotency / re-run)
 *   - logs status transitions so you can SEE the rate_limited → running
 *     loop happen when the worker hits Strava's 100/15min ceiling
 *
 * Usage:
 *   pnpm exec tsx scripts/test-detail-worker.ts <userId>
 *   pnpm exec tsx scripts/test-detail-worker.ts <userId> --reset
 *
 * --reset clears detail_synced_at for ALL of this user's activities before
 * starting. Costs 2 Strava calls per activity. Use sparingly on prod.
 *
 * If interrupted (Ctrl-C) mid-run, the sync_log row may be left at
 * status='running'. Recover with:
 *   UPDATE sync_log SET status='error', finished_at=now() WHERE id=<id>;
 */

import 'dotenv/config'
import { and, count, eq, isNull } from 'drizzle-orm'
import { closeDb, getDb } from '../src/db/client.ts'
import { activities, syncLog } from '../src/db/schema.ts'
import { enqueueDetailFetch } from '../src/features/sync/api/runDetailFetchWorker.server.ts'

const POLL_MS = 2000

async function main() {
  const userId = Number(process.argv[2])
  const reset = process.argv.includes('--reset')

  if (!userId || Number.isNaN(userId)) {
    console.error(
      'Usage: pnpm exec tsx scripts/test-detail-worker.ts <userId> [--reset]',
    )
    process.exit(1)
  }

  const db = getDb()

  if (reset) {
    const result = await db
      .update(activities)
      .set({ detailSyncedAt: null })
      .where(eq(activities.userId, userId))
      .returning({ id: activities.id })
    console.log(`Reset: cleared detail_synced_at for ${result.length} activities.\n`)
  }

  // Pre-flight: how much work + estimated rate-limit pauses?
  const [{ value: total }] = await db
    .select({ value: count() })
    .from(activities)
    .where(eq(activities.userId, userId))

  const [{ value: pending }] = await db
    .select({ value: count() })
    .from(activities)
    .where(
      and(eq(activities.userId, userId), isNull(activities.detailSyncedAt)),
    )

  const estimatedCalls = pending * 2
  const estimatedPauses = Math.max(0, Math.floor((estimatedCalls - 1) / 100))

  console.log(`User ${userId}: ${pending} of ${total} activities need detail.`)
  console.log(`Estimated Strava calls: ${estimatedCalls}`)
  console.log(
    `Estimated rate-limit pauses: ${estimatedPauses} (~${estimatedPauses * 15}min waiting)`,
  )
  console.log()

  if (pending === 0) {
    console.log('Nothing to do. Pass --reset to re-fetch all activities.')
    await closeDb()
    return
  }

  // Fire it.
  const t0 = Date.now()
  const { syncLogId, alreadyRunning } = await enqueueDetailFetch(userId)

  if (!syncLogId) {
    console.error('enqueueDetailFetch returned no syncLogId')
    await closeDb()
    process.exit(1)
  }

  console.log(
    alreadyRunning
      ? `Detail sync already running (syncLogId=${syncLogId}). Tailing it…`
      : `Enqueued detail fetch (syncLogId=${syncLogId}). Tailing…`,
  )
  console.log()

  // Tail loop. We exit when the row hits a terminal status.
  let lastStatus: string | null = null
  while (true) {
    await sleep(POLL_MS)

    const [row] = await db
      .select()
      .from(syncLog)
      .where(eq(syncLog.id, syncLogId))
      .limit(1)

    if (!row) {
      console.error('sync_log row vanished')
      break
    }

    const [{ value: remaining }] = await db
      .select({ value: count() })
      .from(activities)
      .where(
        and(eq(activities.userId, userId), isNull(activities.detailSyncedAt)),
      )

    const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1)
    const statusChanged = row.status !== lastStatus
    const marker = statusChanged ? ' ← status change' : ''
    console.log(
      `[${elapsedSec}s] status=${row.status} callsUsed=${row.callsUsed} remaining=${remaining}${marker}`,
    )
    lastStatus = row.status

    if (row.status === 'success' || row.status === 'error') {
      console.log()
      if (row.error) console.log('error:', row.error)
      console.log(
        `Finished in ${elapsedSec}s. ${row.callsUsed} Strava calls. ${pending - remaining} activities processed.`,
      )
      break
    }
  }

  await closeDb()
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms))

main().catch(async (err) => {
  console.error('FAILED:', err)
  await closeDb()
  process.exit(1)
})
