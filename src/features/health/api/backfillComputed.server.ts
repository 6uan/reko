/**
 * Recompute derived activity data (stream-derived splits + HR zone
 * sustained efforts) for a single user. Used by the profile page's
 * "Recompute" button so self-hosters don't need to ssh and run scripts.
 *
 * Same algorithms as the CLI backfill scripts (lib/streams,
 * lib/heartRate). Idempotent — safe to call repeatedly.
 */

import { eq, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import {
  derivedBestEfforts,
  hrZoneEfforts,
  type NewDerivedBestEffort,
  type NewHrZoneEffort,
} from '@/db/schema'
import { computeBestEfforts, SPLIT_DISTANCES } from '@/lib/streams'
import { computeHrZoneEfforts } from '@/lib/heartRate'

export type RecomputeResult = {
  splitsActivities: number
  splitsRows: number
  hrActivities: number
  hrRows: number
}

/**
 * Runs both backfills for one user.
 *
 * Splits: upserts on (activity_id, name) — old rows update in place.
 * HR zones: deletes the user's rows first then re-inserts, so removing
 * a window from `lib/heartRate.SUSTAINED_WINDOWS` doesn't leave orphans.
 */
export async function backfillComputedData(
  userId: number,
): Promise<RecomputeResult> {
  const db = getDb()

  // ── Splits ──────────────────────────────────────────────────────────
  const splitRowsRaw = await db.execute(sql`
    SELECT
      d.activity_id AS id,
      a.user_id     AS user_id,
      d.data        AS distance_data,
      t.data        AS time_data
    FROM streams d
    JOIN streams t
      ON t.activity_id = d.activity_id AND t.stream_type = 'time'
    JOIN activities a
      ON a.id = d.activity_id
    WHERE d.stream_type = 'distance' AND a.user_id = ${userId}
  `)

  type SplitRow = {
    id: number
    user_id: number
    distance_data: number[]
    time_data: number[]
  }
  const splitList = splitRowsRaw.rows as unknown as SplitRow[]

  const distanceByName = new Map(SPLIT_DISTANCES.map((d) => [d.key, d.meters]))
  let splitsActivities = 0
  let splitsRows = 0

  for (const r of splitList) {
    const efforts = computeBestEfforts(r.distance_data, r.time_data)
    const rows: NewDerivedBestEffort[] = []
    for (const [name, elapsedTime] of Object.entries(efforts)) {
      if (elapsedTime === undefined) continue
      rows.push({
        activityId: Number(r.id),
        userId: r.user_id,
        name,
        distance: distanceByName.get(name as keyof typeof efforts) ?? 0,
        elapsedTime: Math.round(elapsedTime),
      })
    }
    if (rows.length === 0) continue

    await db
      .insert(derivedBestEfforts)
      .values(rows)
      .onConflictDoUpdate({
        target: [derivedBestEfforts.activityId, derivedBestEfforts.name],
        set: {
          elapsedTime: sql`excluded.elapsed_time`,
          distance: sql`excluded.distance`,
          computedAt: sql`now()`,
        },
      })

    splitsRows += rows.length
    splitsActivities++
  }

  // ── HR zone efforts ─────────────────────────────────────────────────
  // Delete this user's existing rows first so we never carry orphaned
  // rows from previous algorithm versions (e.g. retired window sizes).
  await db.delete(hrZoneEfforts).where(eq(hrZoneEfforts.userId, userId))

  const hrRowsRaw = await db.execute(sql`
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
    WHERE d.stream_type = 'distance' AND a.user_id = ${userId}
  `)

  type HrRow = {
    id: number
    user_id: number
    distance_data: number[]
    time_data: number[]
    hr_data: number[]
  }
  const hrList = hrRowsRaw.rows as unknown as HrRow[]

  let hrActivities = 0
  let hrRows = 0

  for (const r of hrList) {
    const efforts = computeHrZoneEfforts(r.distance_data, r.time_data, r.hr_data)
    const rows: NewHrZoneEffort[] = []
    for (const [zoneName, byWindow] of Object.entries(efforts)) {
      if (!byWindow) continue
      for (const [windowSec, paceSecondsPerKm] of Object.entries(byWindow)) {
        rows.push({
          activityId: Number(r.id),
          userId: r.user_id,
          zoneName,
          windowSeconds: Number(windowSec),
          paceSecondsPerKm,
        })
      }
    }
    if (rows.length === 0) continue

    await db.insert(hrZoneEfforts).values(rows)
    hrRows += rows.length
    hrActivities++
  }

  // Pretty-log so server-side readers can see what happened.
  console.log(
    `[backfill] user=${userId} splits: ${splitsRows} rows / ${splitsActivities} activities, hr: ${hrRows} rows / ${hrActivities} activities`,
  )

  return { splitsActivities, splitsRows, hrActivities, hrRows }
}

/** Counts of activities with each kind of computed data, for the
 *  status display on the profile page. */
export type ComputedDataStatus = {
  /** # activities with at least one stream channel stored. */
  withStreams: number
  /** # activities with derived split rows. */
  withDerivedSplits: number
  /** # activities with HR zone effort rows. */
  withHrZoneEfforts: number
}

export async function getComputedDataStatus(
  userId: number,
): Promise<ComputedDataStatus> {
  const db = getDb()

  const [streamsRow, splitsRow, hrRow] = await Promise.all([
    db.execute(sql`
      SELECT count(DISTINCT s.activity_id) AS n
      FROM streams s
      JOIN activities a ON a.id = s.activity_id
      WHERE a.user_id = ${userId}
    `),
    db
      .select({ value: sql<number>`count(DISTINCT activity_id)::int` })
      .from(derivedBestEfforts)
      .where(eq(derivedBestEfforts.userId, userId)),
    db
      .select({ value: sql<number>`count(DISTINCT activity_id)::int` })
      .from(hrZoneEfforts)
      .where(eq(hrZoneEfforts.userId, userId)),
  ])

  return {
    withStreams: Number((streamsRow.rows[0] as { n: number }).n),
    withDerivedSplits: splitsRow[0]?.value ?? 0,
    withHrZoneEfforts: hrRow[0]?.value ?? 0,
  }
}
