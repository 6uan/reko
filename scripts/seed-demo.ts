/**
 * Seed the demo personas: synthetic-but-realistic run history inserted
 * through the same Drizzle schema the Strava sync writes, so the
 * dashboard can't tell the difference. Zero Strava API calls.
 *
 * Personas (scripts/demo/personas.ts):
 *   project    — 18-month improvement arc (demo default)
 *   machine    — high-volume marathoner
 *   newrunner  — 10 weeks, phone-only; the empty-state showcase
 *
 * Idempotent: demo users (users.demo = true) are deleted and reseeded
 * on every run; FK cascades take activities, streams, efforts, and gear
 * with them. Real users are never touched. Data is deterministic per
 * seed version — reseeding produces the same history anchored to today.
 *
 * After inserting, runs the two derived-metric backfills
 * (backfill-derived-splits, backfill-hr-zone-efforts) unless told not
 * to. Note the HR-zone backfill recomputes for ALL users by design.
 *
 * Usage:
 *   node --experimental-strip-types scripts/seed-demo.ts [--dry-run]
 *     [--persona project|machine|newrunner] [--skip-backfills]
 */

import 'dotenv/config'
import { spawnSync } from 'node:child_process'
import { eq, inArray } from 'drizzle-orm'
import { closeDb, getDb } from '../src/db/client.ts'
import {
  activities,
  bestEfforts,
  gear,
  streams,
  users,
  type NewActivity,
  type NewBestEffort,
  type NewGear,
} from '../src/db/schema.ts'
import {
  generatePersonaRuns,
  STRAVA_EFFORT_DISTANCES,
  type GeneratedRun,
} from './demo/generator.ts'
import { PERSONAS } from './demo/personas.ts'
import { hashSeed, mulberry32 } from './demo/rng.ts'

/** Bump to regenerate different (but still deterministic) histories. */
const SEED_VERSION = 'v1'

/** Demo ID space — far above real Strava IDs, comfortably inside 2^53. */
const ACTIVITY_ID_BASE = 9_100_000_000_000
const BEST_EFFORT_ID_BASE = 9_200_000_000_000

const dryRun = process.argv.includes('--dry-run')
const skipBackfills = process.argv.includes('--skip-backfills')
const personaFlag = process.argv.indexOf('--persona')
const onlyPersona =
  personaFlag !== -1 ? process.argv[personaFlag + 1] : undefined

const SPLIT_METERS = new Map<string, number>(STRAVA_EFFORT_DISTANCES)

function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')}/km`
}

async function main() {
  const personas = PERSONAS.filter(
    (p) => !onlyPersona || p.key === onlyPersona,
  )
  if (personas.length === 0) {
    console.error(`Unknown persona '${onlyPersona}'.`)
    process.exit(1)
  }

  const endDate = new Date()
  let activityId = ACTIVITY_ID_BASE
  let bestEffortId = BEST_EFFORT_ID_BASE

  const generated = personas.map((persona) => {
    const rng = mulberry32(hashSeed(`reko-demo-${persona.key}-${SEED_VERSION}`))
    const runs = generatePersonaRuns(persona, endDate, rng)
    return { persona, runs }
  })

  // ── Summary (printed in both modes; the seeder's self-check) ──────────
  for (const { persona, runs } of generated) {
    const km = runs.reduce((a, r) => a + r.distance, 0) / 1000
    const races = runs.filter((r) => r.type === 'race')
    const first = runs[0]
    const last = runs[runs.length - 1]
    const easyRuns = runs.filter((r) => r.type === 'easy')
    const firstEasy = easyRuns[0]
    const lastEasy = easyRuns[easyRuns.length - 1]
    const streamRows = runs.length * (persona.hasHr ? 8 : 6)
    console.log(`\n── ${persona.firstname} ${persona.lastname} (${persona.key}) ──`)
    console.log(`   runs: ${runs.length}   total: ${km.toFixed(0)} km   streams rows: ~${streamRows}`)
    console.log(`   span: ${first.startDateLocal.slice(0, 10)} → ${last.startDateLocal.slice(0, 10)}`)
    console.log(
      `   easy pace: ${fmtPace(1000 / (firstEasy.distance / firstEasy.movingTime) )} → ${fmtPace(1000 / (lastEasy.distance / lastEasy.movingTime))}`,
    )
    for (const race of races) {
      const min = Math.floor(race.movingTime / 60)
      console.log(
        `   race: ${race.name} — ${(race.distance / 1000).toFixed(1)} km in ${Math.floor(min / 60) > 0 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}` : `${min}min`}`,
      )
    }
  }

  if (dryRun) {
    console.log('\n[dry-run] Nothing written.')
    return
  }

  const db = getDb()

  // ── Wipe previous demo data (cascades handle children) ────────────────
  const athleteIds = personas.map((p) => p.stravaAthleteId)
  await db
    .delete(users)
    .where(inArray(users.stravaAthleteId, athleteIds))
  // Safety net: also drop any orphaned demo-flagged users from older seeds.
  if (!onlyPersona) await db.delete(users).where(eq(users.demo, true))

  for (const { persona, runs } of generated) {
    const [user] = await db
      .insert(users)
      .values({
        stravaAthleteId: persona.stravaAthleteId,
        firstname: persona.firstname,
        lastname: persona.lastname,
        demo: true,
      })
      .returning({ id: users.id })
    const userId = user.id

    // ── Assign IDs + compute final PR ranks per split distance ─────────
    const runsWithIds = runs.map((run) => ({ run, id: activityId++ }))
    const effortRows: NewBestEffort[] = []
    const prCountByActivity = new Map<number, number>()

    type EffortDraft = {
      activityId: number
      name: string
      seconds: number
      startDateLocal: string
    }
    const byName = new Map<string, EffortDraft[]>()
    for (const { run, id } of runsWithIds) {
      const times = Object.entries(run.bestEffortTimes) as Array<
        [string, number]
      >
      for (const [name, seconds] of times) {
        const list = byName.get(name) ?? []
        list.push({
          activityId: id,
          name,
          seconds: Math.round(seconds),
          startDateLocal: run.startDateLocal,
        })
        byName.set(name, list)
      }
    }
    for (const [name, drafts] of byName) {
      const ranked = [...drafts].sort((a, b) => a.seconds - b.seconds)
      const prRankOf = new Map<EffortDraft, number>()
      ranked.slice(0, 3).forEach((draft, i) => prRankOf.set(draft, i + 1))
      for (const draft of drafts) {
        const prRank = prRankOf.get(draft) ?? null
        if (prRank === 1) {
          prCountByActivity.set(
            draft.activityId,
            (prCountByActivity.get(draft.activityId) ?? 0) + 1,
          )
        }
        effortRows.push({
          id: bestEffortId++,
          activityId: draft.activityId,
          userId,
          name,
          distance: SPLIT_METERS.get(name) ?? 0,
          elapsedTime: draft.seconds,
          movingTime: draft.seconds,
          startDateLocal: draft.startDateLocal,
          prRank,
        })
      }
    }

    // ── Gear (lifetime distance = prior + assigned runs) ───────────────
    if (persona.gear.length > 0) {
      const meterByGear = new Map<string, number>()
      for (const { run } of runsWithIds) {
        if (run.gearId) {
          meterByGear.set(
            run.gearId,
            (meterByGear.get(run.gearId) ?? 0) + run.distance,
          )
        }
      }
      const gearRows: NewGear[] = persona.gear.map((g) => ({
        id: g.id,
        userId,
        name: g.name,
        brandName: g.brandName,
        modelName: g.modelName,
        nickname: null,
        isPrimary: g.isPrimary,
        retired: g.retired,
        distance: g.priorKm * 1000 + (meterByGear.get(g.id) ?? 0),
      }))
      await db.insert(gear).values(gearRows)
    }

    // ── Activities + streams ───────────────────────────────────────────
    const now = new Date()
    const toActivityRow = (run: GeneratedRun, id: number): NewActivity => ({
      id,
      userId,
      name: run.name,
      type: 'Run',
      sportType: 'Run',
      distance: run.distance,
      movingTime: run.movingTime,
      elapsedTime: run.elapsedTime,
      totalElevationGain: run.totalElevationGain,
      startDate: run.startDate,
      startDateLocal: run.startDateLocal,
      averageSpeed: run.averageSpeed,
      maxSpeed: run.maxSpeed,
      averageHeartrate: run.averageHeartrate,
      maxHeartrate: run.maxHeartrate,
      averageCadence: run.averageCadence,
      prCount: prCountByActivity.get(id) ?? 0,
      hasHeartrate: run.averageHeartrate !== null,
      workoutType: run.workoutType,
      gearId: run.gearId,
      manual: false,
      calories: run.calories,
      sufferScore: run.sufferScore,
      deviceName: run.deviceName,
      elevHigh: run.elevHigh,
      elevLow: run.elevLow,
      raw: {
        demo: true,
        id,
        name: run.name,
        sport_type: 'Run',
        distance: run.distance,
        moving_time: run.movingTime,
        elapsed_time: run.elapsedTime,
        device_name: run.deviceName,
        calories: run.calories,
        splits_metric: run.splitsMetric,
        splits_standard: run.splitsStandard,
        laps: run.laps,
      },
      syncedAt: now,
      // Pre-mark detail as synced so the detail-fetch worker never
      // tries to hit Strava for demo activities.
      detailSyncedAt: now,
    })

    const CHUNK = 50
    for (let i = 0; i < runsWithIds.length; i += CHUNK) {
      const chunk = runsWithIds.slice(i, i + CHUNK)
      await db
        .insert(activities)
        .values(chunk.map(({ run, id }) => toActivityRow(run, id)))
    }

    let streamRows = 0
    for (const { run, id } of runsWithIds) {
      const entries = Object.entries(run.streams) as Array<
        [keyof typeof run.streams, unknown[]]
      >
      await db.insert(streams).values(
        entries.map(([streamType, data]) => ({
          activityId: id,
          streamType,
          data,
          resolution: 'high',
        })),
      )
      streamRows += entries.length
      if (streamRows % 600 === 0) {
        console.log(`   …${persona.key}: ${streamRows} stream rows`)
      }
    }

    const EFFORT_CHUNK = 400
    for (let i = 0; i < effortRows.length; i += EFFORT_CHUNK) {
      await db.insert(bestEfforts).values(effortRows.slice(i, i + EFFORT_CHUNK))
    }

    console.log(
      `✓ ${persona.key}: user ${userId}, ${runsWithIds.length} activities, ${streamRows} stream rows, ${effortRows.length} best efforts, ${persona.gear.length} gear`,
    )
  }

  await closeDb()

  // ── Derived metrics via the existing backfills ─────────────────────────
  if (skipBackfills) {
    console.log(
      '\nSkipped backfills. Run them manually:\n' +
        '  node --experimental-strip-types scripts/backfill-derived-splits.ts\n' +
        '  node --experimental-strip-types scripts/backfill-hr-zone-efforts.ts',
    )
    return
  }
  for (const script of [
    'scripts/backfill-derived-splits.ts',
    'scripts/backfill-hr-zone-efforts.ts',
  ]) {
    console.log(`\n▶ ${script}`)
    const res = spawnSync(
      process.execPath,
      ['--experimental-strip-types', script],
      { stdio: 'inherit' },
    )
    if (res.status !== 0) {
      console.error(`${script} exited with ${res.status}`)
      process.exit(res.status ?? 1)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
