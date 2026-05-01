/**
 * Diagnostic: compute derived best-effort splits for a single activity using
 * the streams stored in the DB. Prints alongside any Strava-provided splits
 * for comparison.
 *
 * Usage:  pnpm exec tsx scripts/check-derived-splits.ts <activity_id>
 */

import 'dotenv/config'
import { and, eq } from 'drizzle-orm'
import { closeDb, getDb } from '../src/db/client.ts'
import { activities, bestEfforts, streams } from '../src/db/schema.ts'
import {
  computeBestEfforts,
  SPLIT_DISTANCES,
} from '../src/lib/streams.ts'

function fmt(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

async function main() {
  const id = Number(process.argv[2])
  if (!Number.isFinite(id)) {
    console.error('usage: tsx scripts/check-derived-splits.ts <activity_id>')
    process.exit(1)
  }
  const db = getDb()

  const [activity] = await db.select().from(activities).where(eq(activities.id, id))
  if (!activity) {
    console.error(`activity ${id} not found`)
    process.exit(1)
  }
  console.log(`\n${activity.name} — ${activity.startDateLocal}`)
  console.log(`distance: ${(activity.distance / 1000).toFixed(2)} km`)
  console.log(`elapsed:  ${fmt(activity.elapsedTime)}\n`)

  const [distRow, timeRow] = await Promise.all([
    db
      .select({ data: streams.data })
      .from(streams)
      .where(and(eq(streams.activityId, id), eq(streams.streamType, 'distance')))
      .limit(1),
    db
      .select({ data: streams.data })
      .from(streams)
      .where(and(eq(streams.activityId, id), eq(streams.streamType, 'time')))
      .limit(1),
  ])
  if (!distRow[0] || !timeRow[0]) {
    console.error('streams missing for this activity')
    process.exit(1)
  }

  const distance = distRow[0].data as number[]
  const time = timeRow[0].data as number[]
  console.log(`stream points: ${distance.length} (distance), ${time.length} (time)\n`)

  const derived = computeBestEfforts(distance, time)

  const stravaRows = await db
    .select({ name: bestEfforts.name, elapsedTime: bestEfforts.elapsedTime })
    .from(bestEfforts)
    .where(eq(bestEfforts.activityId, id))
  const strava = new Map(stravaRows.map((r) => [r.name.toLowerCase(), r.elapsedTime]))

  console.log('Distance      | Strava   | Derived  | Δ')
  console.log('--------------|----------|----------|----------')
  for (const { key, meters } of SPLIT_DISTANCES) {
    if (activity.distance < meters) continue
    const d = derived[key]
    const s = strava.get(key.toLowerCase())
    const ds = d !== undefined ? fmt(d) : '—'
    const ss = s !== undefined ? fmt(s) : '—'
    const delta = d !== undefined && s !== undefined ? fmt(Math.abs(d - s)) : '—'
    console.log(
      `${key.padEnd(13)} | ${ss.padEnd(8)} | ${ds.padEnd(8)} | ${delta}`,
    )
  }

  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
