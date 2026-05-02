/**
 * Backfill `derived_best_efforts` for every activity that has the
 * required (distance, time) streams stored. Idempotent — upserts on
 * (activity_id, name) so re-running just refreshes the values.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-derived-splits.ts [--dry-run]
 */

import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '../src/db/client.ts'
import {
  derivedBestEfforts,
  type NewDerivedBestEffort,
} from '../src/db/schema.ts'
import { computeBestEfforts, SPLIT_DISTANCES } from '../src/lib/streams.ts'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const db = getDb()

  // Activities that have BOTH distance and time streams. We pair them via
  // self-join so we get one row per activity with the two stream blobs.
  const rows = await db.execute(sql`
    SELECT
      d.activity_id AS id,
      a.user_id     AS user_id,
      a.name        AS name,
      a.distance    AS total_distance,
      d.data        AS distance_data,
      t.data        AS time_data
    FROM streams d
    JOIN streams t
      ON t.activity_id = d.activity_id AND t.stream_type = 'time'
    JOIN activities a
      ON a.id = d.activity_id
    WHERE d.stream_type = 'distance'
    ORDER BY a.start_date DESC
  `)

  type Row = {
    id: number
    user_id: number
    name: string
    total_distance: number
    distance_data: number[]
    time_data: number[]
  }
  const list = rows.rows as unknown as Row[]
  console.log(`Activities with streams: ${list.length}`)

  const distanceByName = new Map(SPLIT_DISTANCES.map((d) => [d.key, d.meters]))
  let totalRows = 0
  let activitiesProcessed = 0

  for (const r of list) {
    const efforts = computeBestEfforts(r.distance_data, r.time_data)
    const derivedRows: NewDerivedBestEffort[] = []
    for (const [name, elapsedTime] of Object.entries(efforts)) {
      if (elapsedTime === undefined) continue
      derivedRows.push({
        activityId: Number(r.id),
        userId: r.user_id,
        name,
        distance: distanceByName.get(name as keyof typeof efforts) ?? 0,
        elapsedTime: Math.round(elapsedTime),
      })
    }

    if (derivedRows.length === 0) {
      // Activity too short for any canonical split — still counts as processed.
      activitiesProcessed++
      continue
    }

    if (!dryRun) {
      await db
        .insert(derivedBestEfforts)
        .values(derivedRows)
        .onConflictDoUpdate({
          target: [derivedBestEfforts.activityId, derivedBestEfforts.name],
          set: {
            elapsedTime: sql`excluded.elapsed_time`,
            distance: sql`excluded.distance`,
            computedAt: sql`now()`,
          },
        })
    }

    totalRows += derivedRows.length
    activitiesProcessed++

    if (activitiesProcessed % 25 === 0) {
      console.log(
        `  ${activitiesProcessed}/${list.length} activities, ${totalRows} rows`,
      )
    }
  }

  console.log(
    `${dryRun ? '[dry-run] would write' : 'Wrote'} ${totalRows} derived_best_efforts rows across ${activitiesProcessed} activities`,
  )

  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
