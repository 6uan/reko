/**
 * Activity detail loader (SERVER ONLY).
 *
 * Loads ONE activity — strictly scoped by userId — plus its streams and
 * split efforts, computes all stats on the FULL-resolution streams, and
 * downsamples only the chart series so the client payload stays bounded.
 *
 * Security: the activity is resolved with `id = ? AND userId = ?` before any
 * streams are touched, so a user can't read another athlete's per-second
 * data by guessing activity ids. Returns null when the activity is missing
 * or not owned.
 *
 * Mirrors getActivities.server.ts's "parallel queries + group in JS" shape.
 */

import { and, eq } from 'drizzle-orm'
import { getDb } from '@/db/client'
import {
  activities,
  bestEfforts,
  derivedBestEfforts,
  gear,
  streams,
} from '@/db/schema'
import { SPLIT_DISTANCES } from '@/lib/streams'
import type {
  StravaActivityDetail,
  StravaLap,
  StravaSplit,
} from '@/lib/strava'
import { effectiveBestEffort, type BestEffortTimes } from '@/lib/activities'
import type { HrZoneName } from '@/lib/heartRate'
import {
  aerobicDecoupling,
  buildSeries,
  gradeAdjustedPace,
  timeInZones,
  type Decoupling,
  type SeriesRow,
  type StreamChannels,
} from '@/features/dashboard/activity/metrics'

/** Chart series point budget — stats are computed on full-res, not this. */
const SERIES_TARGET = 500

export type SplitRow = {
  key: keyof BestEffortTimes
  meters: number
  seconds: number
  /** True when only our derived computation had it (Strava reported none). */
  derived: boolean
}

/** A per-unit pace split (per-km or per-mile) for the splits table. SI units. */
export type PaceSplit = {
  index: number
  distanceM: number
  seconds: number
  paceSecPerKm: number
  elevM: number | null
  hr: number | null
}

/** A lap row for the laps table. SI units. */
export type LapRow = {
  index: number
  name: string | null
  distanceM: number
  seconds: number
  paceSecPerKm: number
  hr: number | null
  cadenceSpm: number | null
}

export type ActivityDetailPayload = {
  activity: {
    id: number
    name: string
    type: string
    sportType: string | null
    /** ISO string (normalized from wall-clock startDateLocal). */
    date: string
    distanceMeters: number
    movingTime: number
    elapsedTime: number
    avgSpeed: number
    avgHr: number | null
    maxHr: number | null
    /** Steps per minute (Strava RPM × 2), or null. */
    cadenceSpm: number | null
    elevationGain: number
  }
  /** The gear (shoe) this activity used, with lifetime mileage, or null. */
  gear: { name: string; distanceMeters: number } | null
  /** Whether time + distance streams are present (charts can render). */
  hasStreams: boolean
  /**
   * Whether the detail-fetch worker has already processed this activity. Lets
   * the UI tell "still syncing" apart from "synced, but Strava had no stream
   * data" (manual entries, no-GPS treadmill runs) when hasStreams is false.
   */
  detailSynced: boolean
  /** Which optional channels exist — gates each section client-side. */
  channels: {
    elev: boolean
    hr: boolean
    cad: boolean
    grade: boolean
    pace: boolean
  }
  series: SeriesRow[]
  stats: {
    rawPaceSecPerKm: number | null
    gapPaceSecPerKm: number | null
    decoupling: Decoupling
    timeInZones: Record<HrZoneName, number> | null
  }
  splits: SplitRow[]
  /** Per-km splits (Strava splits_metric), mapped to SI. */
  splitsMetric: PaceSplit[]
  /** Per-mile splits (Strava splits_standard), mapped to SI. */
  splitsStandard: PaceSplit[]
  /** Auto/manual laps. */
  laps: LapRow[]
  /** Decoded GPS route as [lng, lat] points (downsampled), or null. */
  route: [number, number][] | null
}

function mapPaceSplit(s: StravaSplit, i: number): PaceSplit {
  const distanceM = s.distance
  const seconds = s.moving_time
  const paceSecPerKm =
    s.average_speed > 0
      ? 1000 / s.average_speed
      : seconds > 0 && distanceM > 0
        ? seconds / (distanceM / 1000)
        : 0
  return {
    index: s.split ?? i + 1,
    distanceM,
    seconds,
    paceSecPerKm,
    elevM: s.elevation_difference ?? null,
    hr: s.average_heartrate ?? null,
  }
}

function mapLap(l: StravaLap, i: number): LapRow {
  return {
    index: l.lap_index ?? i + 1,
    name: l.name ?? null,
    distanceM: l.distance,
    seconds: l.moving_time,
    paceSecPerKm: l.average_speed > 0 ? 1000 / l.average_speed : 0,
    hr: l.average_heartrate ?? null,
    cadenceSpm:
      l.average_cadence != null ? Math.round(l.average_cadence * 2) : null,
  }
}

/**
 * Downsample a Strava `latlng` stream ([[lat,lng], …]) to ~target points and
 * flip to [lng,lat] for the map / SVG renderers. Null if absent or too short.
 */
function buildRoute(data: unknown, target: number): [number, number][] | null {
  if (!Array.isArray(data) || data.length < 2) return null
  const step = Math.max(1, Math.floor(data.length / target))
  const out: [number, number][] = []
  const push = (p: unknown) => {
    if (Array.isArray(p) && typeof p[0] === 'number' && typeof p[1] === 'number') {
      out.push([p[1], p[0]]) // [lat,lng] → [lng,lat]
    }
  }
  for (let i = 0; i < data.length; i += step) push(data[i])
  push(data[data.length - 1])
  return out.length >= 2 ? out : null
}

/**
 * Narrow a JSONB stream `data` cell to a scalar number[]. Preserves length
 * (so channels stay index-aligned) by coercing bad samples to NaN —
 * per-sample guards in metrics.ts skip those. Returns null for a non-array,
 * a `latlng`-style nested array, or a channel with no numeric samples, so
 * the channel is treated as ABSENT rather than producing garbage.
 */
function toNumberArray(data: unknown): number[] | null {
  if (!Array.isArray(data)) return null
  const out = new Array<number>(data.length)
  let sawNumber = false
  for (let i = 0; i < data.length; i++) {
    const x = data[i]
    if (typeof x === 'number' && Number.isFinite(x)) {
      out[i] = x
      sawNumber = true
    } else if (Array.isArray(x)) {
      return null // latlng or nested — wrong shape for a scalar channel
    } else {
      out[i] = NaN
    }
  }
  return sawNumber ? out : null
}

/** Map a Strava best-effort name variant to our canonical key (or null). */
function canonicalEffortName(name: string): keyof BestEffortTimes | null {
  switch (name.toLowerCase()) {
    case '1k':
      return '1k'
    case '1 mile':
      return '1 mile'
    case '5k':
      return '5k'
    case '10k':
      return '10k'
    case 'half-marathon':
      return 'Half-Marathon'
    case 'marathon':
      return 'Marathon'
    default:
      return null
  }
}

export async function getActivityDetail(
  userId: number,
  activityId: number,
): Promise<ActivityDetailPayload | null> {
  const db = getDb()

  // 1. Ownership gate — resolve the activity scoped by userId FIRST.
  const [activity] = await db
    .select()
    .from(activities)
    .where(and(eq(activities.id, activityId), eq(activities.userId, userId)))
    .limit(1)

  if (!activity) return null

  // Gear (shoe) used, if this activity is tagged with any.
  const gearRow = activity.gearId
    ? (
        await db
          .select({
            name: gear.name,
            nickname: gear.nickname,
            distance: gear.distance,
          })
          .from(gear)
          .where(eq(gear.id, activity.gearId))
          .limit(1)
      )[0]
    : undefined

  // Laps + per-unit splits come straight from the stored detail payload
  // (storeActivityDetail mirrors the full detail into `raw`).
  const rawDetail =
    activity.raw && typeof activity.raw === 'object'
      ? (activity.raw as StravaActivityDetail)
      : null
  const splitsMetric = (rawDetail?.splits_metric ?? []).map(mapPaceSplit)
  const splitsStandard = (rawDetail?.splits_standard ?? []).map(mapPaceSplit)
  const laps = (rawDetail?.laps ?? []).map(mapLap)

  // 2. Streams + splits in parallel (ownership already proven).
  const [streamRows, dbEfforts, dbDerived] = await Promise.all([
    db
      .select({ streamType: streams.streamType, data: streams.data })
      .from(streams)
      .where(eq(streams.activityId, activityId)),
    db
      .select({
        name: bestEfforts.name,
        elapsedTime: bestEfforts.elapsedTime,
      })
      .from(bestEfforts)
      .where(
        and(
          eq(bestEfforts.userId, userId),
          eq(bestEfforts.activityId, activityId),
        ),
      ),
    db
      .select({
        name: derivedBestEfforts.name,
        elapsedTime: derivedBestEfforts.elapsedTime,
      })
      .from(derivedBestEfforts)
      .where(
        and(
          eq(derivedBestEfforts.userId, userId),
          eq(derivedBestEfforts.activityId, activityId),
        ),
      ),
  ])

  // Narrow JSONB → number[] per channel (unclean / latlng ⇒ absent).
  const ch = new Map<string, number[]>()
  for (const row of streamRows) {
    const arr = toNumberArray(row.data)
    if (arr) ch.set(row.streamType, arr)
  }
  const time = ch.get('time')
  const distance = ch.get('distance')
  const altitude = ch.get('altitude')
  const velocity = ch.get('velocity_smooth')
  const heartrate = ch.get('heartrate')
  const cadence = ch.get('cadence')
  const grade = ch.get('grade_smooth')

  // Decoded GPS route for the map/trace — latlng is nested so it bypasses the
  // scalar `ch` map above; read it straight from the stream rows.
  const route = buildRoute(
    streamRows.find((r) => r.streamType === 'latlng')?.data,
    400,
  )

  const hasStreams =
    !!time && !!distance && time.length >= 2 && distance.length >= 2

  const channels = {
    elev: hasStreams && !!altitude,
    hr: hasStreams && !!heartrate,
    cad: hasStreams && !!cadence,
    grade: hasStreams && !!grade,
    pace: hasStreams && !!velocity,
  }

  let series: SeriesRow[] = []
  let stats: ActivityDetailPayload['stats'] = {
    rawPaceSecPerKm: null,
    gapPaceSecPerKm: null,
    decoupling: { applicable: false },
    timeInZones: null,
  }

  if (hasStreams && time && distance) {
    const chans: StreamChannels = {
      time,
      distance,
      altitude,
      velocity,
      heartrate,
      cadence,
      grade,
    }
    series = buildSeries(chans, SERIES_TARGET)

    const gap = gradeAdjustedPace(distance, time, grade ?? [], velocity)
    stats = {
      rawPaceSecPerKm: gap.rawPaceSecPerKm,
      gapPaceSecPerKm: grade ? gap.gapPaceSecPerKm : null,
      decoupling: heartrate
        ? aerobicDecoupling(distance, time, heartrate, velocity)
        : { applicable: false },
      timeInZones: heartrate ? timeInZones(heartrate, time) : null,
    }
  }

  // 3. Splits — reuse the shared split distances + effort-preference helper
  // rather than recomputing from streams.
  const best: BestEffortTimes = {}
  for (const e of dbEfforts) {
    const key = canonicalEffortName(e.name)
    if (!key) continue
    const cur = best[key]
    if (cur === undefined || e.elapsedTime < cur) best[key] = e.elapsedTime
  }
  const derived: BestEffortTimes = {}
  for (const d of dbDerived) {
    derived[d.name as keyof BestEffortTimes] = d.elapsedTime
  }
  const splits: SplitRow[] = []
  for (const { key, meters } of SPLIT_DISTANCES) {
    const seconds = effectiveBestEffort(
      { bestEfforts: best, derivedBestEfforts: derived },
      key,
    )
    if (seconds !== undefined) {
      splits.push({ key, meters, seconds, derived: best[key] === undefined })
    }
  }

  return {
    activity: {
      id: activity.id,
      name: activity.name,
      type: activity.type,
      sportType: activity.sportType,
      date: activity.startDateLocal.replace(' ', 'T') + 'Z',
      distanceMeters: activity.distance,
      movingTime: activity.movingTime,
      elapsedTime: activity.elapsedTime,
      avgSpeed: activity.averageSpeed ?? 0,
      avgHr: activity.averageHeartrate,
      maxHr: activity.maxHeartrate,
      cadenceSpm: activity.averageCadence
        ? Math.round(activity.averageCadence * 2)
        : null,
      elevationGain: activity.totalElevationGain,
    },
    gear: gearRow
      ? {
          name: gearRow.nickname || gearRow.name,
          distanceMeters: gearRow.distance,
        }
      : null,
    hasStreams,
    detailSynced: activity.detailSyncedAt !== null,
    channels,
    series,
    stats,
    splits,
    splitsMetric,
    splitsStandard,
    laps,
    route,
  }
}
