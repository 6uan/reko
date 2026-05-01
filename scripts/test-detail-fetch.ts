/**
 * Manual smoke test for storeActivityDetail() — Chunk 1.2.a verification.
 *
 * Runs the detail-fetch + store pipeline against a SINGLE activity and
 * prints what landed in the DB. Use this before wiring up the worker
 * (1.2.b) to confirm:
 *   - Strava endpoints work and our types match the response shape
 *   - best_efforts upsert respects ON CONFLICT (re-running is idempotent)
 *   - streams upsert keys correctly on (activity_id, stream_type)
 *   - syncedAt bumps on the activity row
 *
 * Usage:
 *   pnpm exec tsx scripts/test-detail-fetch.ts <userId> [activityId]
 *
 * If activityId is omitted, picks the most recent activity for the user.
 *
 * NOTE: Costs 2 Strava API calls per run. Re-runs are idempotent but
 * still cost 2 calls each — Strava can't tell we already have the data.
 */

import 'dotenv/config'
import { desc, eq } from 'drizzle-orm'
import { getDb, closeDb } from '../src/db/client.ts'
import {
  activities,
  bestEfforts,
  streams,
} from '../src/db/schema.ts'
import { storeActivityDetail } from '../src/features/sync/api/storeActivityDetail.server.ts'
import { withFreshToken } from '../src/features/sync/api/withFreshToken.server.ts'

async function main() {
  const userId = Number(process.argv[2])
  let activityId = process.argv[3] ? Number(process.argv[3]) : null

  if (!userId || Number.isNaN(userId)) {
    console.error(
      'Usage: pnpm exec tsx scripts/test-detail-fetch.ts <userId> [activityId]',
    )
    process.exit(1)
  }

  const db = getDb()

  // Pick a default activity if the caller didn't specify one.
  if (!activityId) {
    const [recent] = await db
      .select({ id: activities.id, name: activities.name })
      .from(activities)
      .where(eq(activities.userId, userId))
      .orderBy(desc(activities.startDate))
      .limit(1)

    if (!recent) {
      console.error(`No activities found for user ${userId}. Run a backfill first.`)
      process.exit(1)
    }

    activityId = recent.id
    console.log(`No activityId given — using most recent: ${recent.id} "${recent.name}"`)
  } else {
    const [act] = await db
      .select({ name: activities.name })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1)
    if (!act) {
      console.error(`Activity ${activityId} not found in DB for any user.`)
      process.exit(1)
    }
    console.log(`Testing detail fetch for ${activityId} "${act.name}"`)
  }

  console.log('\nFetching access token + Strava detail + streams in parallel...')
  const t0 = Date.now()
  const accessToken = await withFreshToken(userId)
  const result = await storeActivityDetail(accessToken, userId, activityId)
  const ms = Date.now() - t0

  console.log(`\nstoreActivityDetail completed in ${ms}ms`)
  console.log(result)

  // ── Verify what landed in the DB ────────────────────────────────────
  console.log('\n── best_efforts rows ───────────────────────────────────')
  const efforts = await db
    .select({
      name: bestEfforts.name,
      distance: bestEfforts.distance,
      elapsedTime: bestEfforts.elapsedTime,
      prRank: bestEfforts.prRank,
    })
    .from(bestEfforts)
    .where(eq(bestEfforts.activityId, activityId))
  if (efforts.length === 0) {
    console.log('  (none — short activity, or Strava had no splits)')
  } else {
    console.table(efforts)
  }

  console.log('\n── streams rows ────────────────────────────────────────')
  const streamRows = await db
    .select({
      streamType: streams.streamType,
      resolution: streams.resolution,
      data: streams.data,
    })
    .from(streams)
    .where(eq(streams.activityId, activityId))

  if (streamRows.length === 0) {
    console.log('  (none — activity has no recorded streams)')
  } else {
    // `data` is a long array — show length only, not the array itself.
    console.table(
      streamRows.map((r) => ({
        streamType: r.streamType,
        resolution: r.resolution,
        dataPoints: Array.isArray(r.data) ? r.data.length : '?',
      })),
    )
  }

  // ── Confirm syncedAt bumped ─────────────────────────────────────────
  const [updated] = await db
    .select({ syncedAt: activities.syncedAt })
    .from(activities)
    .where(eq(activities.id, activityId))
  console.log(`\nactivities.syncedAt → ${updated?.syncedAt?.toISOString()}`)

  await closeDb()
}

main().catch(async (err) => {
  console.error('\nFAILED:', err)
  await closeDb()
  process.exit(1)
})
