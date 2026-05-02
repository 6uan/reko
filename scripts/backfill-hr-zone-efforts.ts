/**
 * Backfill `hr_zone_efforts` for every activity that has the required
 * heartrate / distance / time streams. Idempotent.
 *
 * Truncates first so old rows from earlier (single-window) versions of
 * the algorithm are removed before the new (per-zone, multi-window)
 * rows are written.
 *
 * Usage:
 *   node --experimental-strip-types scripts/backfill-hr-zone-efforts.ts [--dry-run]
 */

import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { closeDb, getDb } from '../src/db/client.ts'
import { hrZoneEfforts, type NewHrZoneEffort } from '../src/db/schema.ts'
import { computeHrZoneEfforts } from '../src/lib/heartRate.ts'

const dryRun = process.argv.includes('--dry-run')

async function main() {
  const db = getDb()

  const rows = await db.execute(sql`
    SELECT
      d.activity_id AS id,
      a.user_id     AS user_id,
      d.data        AS distance_data,
      t.data        AS time_data,
      h.data        AS hr_data
    FROM streams d
    JOIN streams t
      ON t.activity_id = d.activity_id AND t.stream_type = 'time'
    JOIN streams h
      ON h.activity_id = d.activity_id AND h.stream_type = 'heartrate'
    JOIN activities a
      ON a.id = d.activity_id
    WHERE d.stream_type = 'distance'
    ORDER BY a.start_date DESC
  `)

  type Row = {
    id: number
    user_id: number
    distance_data: number[]
    time_data: number[]
    hr_data: number[]
  }
  const list = rows.rows as unknown as Row[]
  console.log(`Activities with HR + distance + time streams: ${list.length}`)

  if (!dryRun) {
    const deleted = await db.execute(sql`DELETE FROM hr_zone_efforts`)
    console.log(`Cleared old hr_zone_efforts (${deleted.rowCount ?? 0} rows)`)
  }

  let totalRows = 0
  let activitiesWithEfforts = 0

  for (const r of list) {
    const efforts = computeHrZoneEfforts(r.distance_data, r.time_data, r.hr_data)
    const hrRows: NewHrZoneEffort[] = []
    for (const [zoneName, byWindow] of Object.entries(efforts)) {
      if (!byWindow) continue
      for (const [windowSec, paceSecondsPerKm] of Object.entries(byWindow)) {
        hrRows.push({
          activityId: Number(r.id),
          userId: r.user_id,
          zoneName,
          windowSeconds: Number(windowSec),
          paceSecondsPerKm,
        })
      }
    }

    if (hrRows.length === 0) continue

    if (!dryRun) {
      await db
        .insert(hrZoneEfforts)
        .values(hrRows)
        .onConflictDoUpdate({
          target: [
            hrZoneEfforts.activityId,
            hrZoneEfforts.zoneName,
            hrZoneEfforts.windowSeconds,
          ],
          set: {
            paceSecondsPerKm: sql`excluded.pace_seconds_per_km`,
            computedAt: sql`now()`,
          },
        })
    }

    totalRows += hrRows.length
    activitiesWithEfforts++
  }

  console.log(
    `${dryRun ? '[dry-run] would write' : 'Wrote'} ${totalRows} hr_zone_efforts rows across ${activitiesWithEfforts} activities`,
  )

  await closeDb()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
