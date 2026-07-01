/**
 * Demo run synthesizer — the HOW of the seeder.
 *
 * Takes a persona's planned run and produces the same artifacts the
 * Strava sync pipeline stores: activity aggregates, full per-sample
 * streams (time / distance / latlng / altitude / velocity_smooth /
 * moving, plus heartrate / cadence when the persona has a watch),
 * splits_metric / splits_standard / laps for the `raw` payload, and
 * best-effort times computed with the app's own sliding window.
 *
 * Everything is driven by the run's seeded RNG — same seed, same run.
 */

import { bestSplitSeconds } from '../../src/lib/streams.ts'
import { chance, gaussian, pickWeighted, uniform, type Rng } from './rng.ts'
import { ROUTES, segmentMeters, type RouteTemplate } from './routes.ts'
import type { PersonaConfig, PlannedRun, RunType } from './personas.ts'

const M_PER_DEG_LAT = 111_320

/**
 * The distances Strava precomputes `best_efforts` at, with its exact
 * `name` strings — the records UI matches these byte-for-byte
 * (src/features/dashboard/records/distances.ts), so casing matters:
 * it's `1K`/`5K`/`10K`, not the lowercase derived-effort vocabulary.
 */
export const STRAVA_EFFORT_DISTANCES: Array<[string, number]> = [
  ['400m', 400],
  ['1/2 mile', 804.67],
  ['1K', 1000],
  ['1 mile', 1609.34],
  ['2 mile', 3218.69],
  ['5K', 5000],
  ['10K', 10000],
  ['15K', 15000],
  ['10 mile', 16093.4],
  ['20K', 20000],
  ['Half-Marathon', 21097.5],
  ['Marathon', 42195],
]

// ── Pace model ───────────────────────────────────────────────────────────

/** Whole-run pace factor vs the persona's current easy pace. */
function typePaceFactor(type: RunType, km: number): number {
  switch (type) {
    case 'recovery':
      return 1.06
    case 'long':
      return 1.03
    case 'tempo':
      return 0.93 // warmup/cooldown handled per-segment below
    case 'intervals':
      return 1 // segments carry the structure
    case 'race':
      if (km <= 6) return 0.85
      if (km <= 12) return 0.875
      if (km <= 25) return 0.9
      return 0.945
    case 'easy':
      return 1
  }
}

/** Miami heat tax, seconds/km by month (0 = Jan). */
const HEAT_PENALTY = [0, 0, 4, 8, 14, 22, 27, 27, 22, 12, 4, 0]

/** Effort as fraction of HR reserve for a run type. */
function hrEffortFrac(
  persona: PersonaConfig,
  type: RunType,
  km: number,
  fitness: number,
): number {
  const easy = persona.easyHrFracAt(fitness)
  switch (type) {
    case 'recovery':
      return easy - 0.05
    case 'easy':
      return easy
    case 'long':
      return easy + 0.03
    case 'tempo':
      return 0.8
    case 'intervals':
      return 0.9 // per-segment targets refine this
    case 'race':
      if (km <= 6) return 0.93
      if (km <= 12) return 0.91
      if (km <= 25) return 0.87
      return 0.82
  }
}

// ── Structured-run segments ──────────────────────────────────────────────

type Segment = { meters: number; paceFactor: number; hrFrac?: number }

/** Break a run into pace segments (warmups, reps, bodies, cooldowns). */
function segmentsFor(
  type: RunType,
  meters: number,
  rng: Rng,
): { segments: Segment[]; repCount?: number } {
  if (type === 'tempo') {
    const wu = Math.min(1600, meters * 0.25)
    const cd = Math.min(1100, meters * 0.18)
    return {
      segments: [
        { meters: wu, paceFactor: 1.04, hrFrac: -1 },
        { meters: meters - wu - cd, paceFactor: 0.86, hrFrac: 0.8 },
        { meters: cd, paceFactor: 1.06, hrFrac: -1 },
      ],
    }
  }
  if (type === 'intervals') {
    const wu = 1600
    const cd = 1100
    const repMeters = 400
    const jogMeters = 200
    const budget = meters - wu - cd
    const repCount = Math.max(
      4,
      Math.floor(budget / (repMeters + jogMeters)),
    )
    const segments: Segment[] = [{ meters: wu, paceFactor: 1.05, hrFrac: -1 }]
    for (let i = 0; i < repCount; i++) {
      segments.push({
        meters: repMeters,
        paceFactor: uniform(rng, 0.76, 0.8),
        hrFrac: 0.92,
      })
      segments.push({ meters: jogMeters, paceFactor: 1.18, hrFrac: 0.72 })
    }
    segments.push({ meters: cd, paceFactor: 1.07, hrFrac: -1 })
    return { segments, repCount }
  }
  // Unstructured runs: one segment; drift/negative splits applied later.
  return { segments: [{ meters, paceFactor: 1 }] }
}

// ── Route sampling ───────────────────────────────────────────────────────

type Corridor = {
  route: RouteTemplate
  cumulative: number[]
  oneWay: number
}

function buildCorridor(route: RouteTemplate): Corridor {
  const cumulative = [0]
  for (let i = 1; i < route.waypoints.length; i++) {
    cumulative.push(
      cumulative[i - 1] +
        segmentMeters(route.waypoints[i - 1], route.waypoints[i]),
    )
  }
  return { route, cumulative, oneWay: cumulative[cumulative.length - 1] }
}

/** Corridor position for a raw run distance (fold for out-and-back, wrap track laps). */
function corridorPosition(c: Corridor, meters: number): number {
  if (c.route.kind === 'track') return meters % c.oneWay
  const fold = meters % (2 * c.oneWay)
  return fold <= c.oneWay ? fold : 2 * c.oneWay - fold
}

function pointAt(c: Corridor, pos: number): [number, number] {
  const { waypoints } = c.route
  const { cumulative } = c
  let i = 1
  while (i < cumulative.length - 1 && cumulative[i] < pos) i++
  const segLen = cumulative[i] - cumulative[i - 1] || 1
  const t = Math.min(1, Math.max(0, (pos - cumulative[i - 1]) / segLen))
  const a = waypoints[i - 1]
  const b = waypoints[i]
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

function elevationAt(c: Corridor, pos: number): number {
  const frac = pos / c.oneWay
  let elev = 3
  for (const bump of c.route.elevationBumps) {
    const d = (frac - bump.at) / bump.width
    elev += bump.height * Math.exp(-d * d)
  }
  return elev
}

/** Expected stoplight pauses per meter for a route. */
function pauseRate(routeKey: string): number {
  switch (routeKey) {
    case 'brickellBaywalk':
      return 1 / 2500
    case 'southBeach':
      return 1 / 4000
    case 'oldCutler':
      return 1 / 5000
    case 'rickenbacker':
      return 1 / 9000
    default:
      return 0
  }
}

// ── Naming ───────────────────────────────────────────────────────────────

function defaultNameFor(hour: number): string {
  if (hour < 11) return 'Morning Run'
  if (hour < 14) return 'Lunch Run'
  if (hour < 18) return 'Afternoon Run'
  if (hour < 22) return 'Evening Run'
  return 'Night Run'
}

function nameFor(
  plan: PlannedRun,
  route: RouteTemplate,
  hour: number,
  rng: Rng,
  repCount?: number,
): string {
  if (plan.type === 'race' && plan.raceName) return plan.raceName
  if (plan.type === 'intervals') {
    return chance(rng, 0.6)
      ? `${repCount ?? 8}×400 @ ${route.name}`
      : 'Track Tuesday'
  }
  if (plan.type === 'tempo' && chance(rng, 0.6)) {
    return `Tempo — ${route.name}`
  }
  if (plan.type === 'long' && chance(rng, 0.55)) {
    return `Long run — ${route.name}`
  }
  if ((plan.type === 'easy' || plan.type === 'recovery') && chance(rng, 0.22)) {
    return pickWeighted(rng, [
      [`${route.name} miles`, 3],
      ['Easy miles', 3],
      ['Shakeout', 2],
      ['Unwind run', 1],
    ])
  }
  return defaultNameFor(hour)
}

// ── Start times ──────────────────────────────────────────────────────────

function startHourFor(
  persona: PersonaConfig,
  type: RunType,
  dayOfWeek: number,
  month: number,
  rng: Rng,
): number {
  const summer = month >= 5 && month <= 8
  if (type === 'race') return 6.5 + uniform(rng, 0, 0.4)
  if (type === 'long') return (summer ? 6 : 7) + uniform(rng, 0, 1)
  if (persona.key === 'machine') return 5.75 + uniform(rng, 0, 0.7)
  const weekend = dayOfWeek >= 5
  if (weekend) return (summer ? 7 : 8.5) + uniform(rng, 0, 1.5)
  // Weekday: evenings, except in the swamp months.
  return summer ? 6.5 + uniform(rng, 0, 1) : 18 + uniform(rng, 0, 1.5)
}

// ── Types the seeder consumes ────────────────────────────────────────────

export type GeneratedStreams = {
  time: number[]
  distance: number[]
  latlng: Array<[number, number]>
  altitude: number[]
  velocity_smooth: number[]
  moving: number[]
  heartrate?: number[]
  cadence?: number[]
}

export type SplitRow = {
  split: number
  distance: number
  elapsed_time: number
  moving_time: number
  average_speed: number
  elevation_difference: number
  average_heartrate?: number
  pace_zone: number
}

export type LapRow = {
  lap_index: number
  name: string
  distance: number
  elapsed_time: number
  moving_time: number
  average_speed: number
  start_index: number
  end_index: number
  average_heartrate?: number
  total_elevation_gain: number
}

export type GeneratedRun = {
  week: number
  type: RunType
  routeKey: string
  name: string
  startDate: Date
  /** "YYYY-MM-DD HH:MM:SS" Miami wall clock. */
  startDateLocal: string
  distance: number
  movingTime: number
  elapsedTime: number
  totalElevationGain: number
  averageSpeed: number
  maxSpeed: number
  averageHeartrate: number | null
  maxHeartrate: number | null
  averageCadence: number | null
  workoutType: number | null
  calories: number
  sufferScore: number | null
  deviceName: string | null
  elevHigh: number
  elevLow: number
  streams: GeneratedStreams
  splitsMetric: SplitRow[]
  splitsStandard: SplitRow[]
  laps: LapRow[]
  /** Strava-named effort → elapsed seconds, for the best_efforts table. */
  bestEffortTimes: Record<string, number>
  gearId: string | null
}

// ── Core synthesis ───────────────────────────────────────────────────────

function pickRoute(
  persona: PersonaConfig,
  type: RunType,
  rng: Rng,
): RouteTemplate {
  const weights =
    persona.routeWeights[type] ?? persona.routeWeights.easy ?? [
      ['brickellBaywalk', 1],
    ]
  return ROUTES[pickWeighted(rng, weights as Array<[string, number]>)]
}

function pickGear(
  persona: PersonaConfig,
  type: RunType,
  week: number,
  rng: Rng,
): string | null {
  const inWindow = persona.gear.filter(
    (g) => week >= g.fromWeek && week <= g.toWeek,
  )
  if (inWindow.length === 0) return null
  const typed = inWindow.filter((g) => g.forTypes.includes(type))
  if (typed.length > 0) return typed[0].id
  const daily = inWindow.filter((g) => g.forTypes.length === 0)
  if (daily.length === 0) return inWindow[0].id
  if (daily.length === 1) return daily[0].id
  // Overlapping rotation: favor the newer shoe.
  return chance(rng, 0.7) ? daily[daily.length - 1].id : daily[0].id
}

/** Format a Date's components as Miami wall clock "YYYY-MM-DD HH:MM:SS". */
function formatLocal(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${y}-${p(mo + 1)}-${p(d)} ${p(h)}:${p(mi)}:${p(s)}`
}

/** Rough EST/EDT offset by month — good enough for demo data. */
function utcOffsetHours(month: number): number {
  return month >= 2 && month <= 10 ? 4 : 5
}

export function synthesizeRun(
  persona: PersonaConfig,
  plan: PlannedRun,
  week: number,
  runDate: { y: number; mo: number; d: number; dow: number },
  rng: Rng,
): GeneratedRun {
  const frac = week / persona.weeks
  const fitness = persona.fitnessAt(frac)
  const route = pickRoute(persona, plan.type, rng)
  const corridor = buildCorridor(route)
  // Races over-read slightly, like real GPS — and without the overage
  // the sliding window can never cover the race's own exact distance.
  const meters =
    plan.km * 1000 * (plan.type === 'race' ? uniform(rng, 1.005, 1.012) : 1)

  // Run-level target pace (s/km).
  const easyPace = persona.easyPaceAt(fitness)
  const heat = HEAT_PENALTY[runDate.mo] * (plan.type === 'race' ? 0.5 : 1)
  const noise = gaussian(rng, 0, plan.type === 'race' ? 3 : 6)
  const basePace =
    easyPace * typePaceFactor(plan.type, plan.km) + heat + noise

  const { segments, repCount } = segmentsFor(plan.type, meters, rng)

  const dt = route.kind === 'track' ? 2 : 4
  const time: number[] = []
  const distance: number[] = []
  const latlng: Array<[number, number]> = []
  const altitude: number[] = []
  /** Noise-free profile — elevation gain must not sum GPS noise. */
  const cleanElevation: number[] = []
  const velocity: number[] = []
  const moving: number[] = []
  const heartrate: number[] = []
  const cadence: number[] = []

  const mPerDegLng =
    M_PER_DEG_LAT * Math.cos((route.waypoints[0][0] * Math.PI) / 180)

  let t = 0
  let d = 0
  let segIdx = 0
  let segStartMeters = 0
  let wander = 0
  let jitterLatM = 0
  let jitterLngM = 0
  let pausedSeconds = 0
  let pauseLeft = 0
  const hrModel = {
    value: persona.hrRest + 0.5 * (persona.hrMax - persona.hrRest),
  }
  const rate = pauseRate(route.key)
  const cadenceBase = persona.cadenceSpmAt(fitness)

  while (d < meters) {
    // Advance to the current pace segment.
    while (
      segIdx < segments.length - 1 &&
      d - segStartMeters >= segments[segIdx].meters
    ) {
      segStartMeters += segments[segIdx].meters
      segIdx++
    }
    const seg = segments[segIdx]

    // Pace for this tick.
    wander = wander * 0.92 + gaussian(rng, 0, 0.013)
    wander = Math.max(-0.06, Math.min(0.06, wander))
    let paceFactor = seg.paceFactor * (1 + wander)
    const progress = d / meters
    if (plan.type === 'long') paceFactor *= 1 + 0.04 * progress * progress
    if (plan.type === 'race' && plan.km > 25)
      paceFactor *= 1 + 0.05 * progress * progress
    if (plan.type === 'race' && plan.km <= 12)
      paceFactor *= 1.025 - 0.05 * progress // gentle negative split
    const paceNow = Math.max(150, basePace * paceFactor)
    const speed = 1000 / paceNow // m/s

    const paused = pauseLeft > 0
    if (paused) {
      pauseLeft -= dt
      pausedSeconds += dt
    } else if (
      plan.type !== 'race' &&
      route.kind !== 'track' &&
      chance(rng, rate * speed * dt)
    ) {
      pauseLeft = uniform(rng, 8, 45)
    }

    if (!paused) d += speed * dt
    t += dt

    // Position + GPS jitter (correlated, a few meters).
    jitterLatM = jitterLatM * 0.86 + gaussian(rng, 0, 1.1)
    jitterLngM = jitterLngM * 0.86 + gaussian(rng, 0, 1.1)
    const pos = corridorPosition(corridor, d)
    const [lat, lng] = pointAt(corridor, pos)
    latlng.push([
      Number((lat + jitterLatM / M_PER_DEG_LAT).toFixed(6)),
      Number((lng + jitterLngM / mPerDegLng).toFixed(6)),
    ])
    const cleanElev = elevationAt(corridor, pos)
    cleanElevation.push(cleanElev)
    altitude.push(Number((cleanElev + gaussian(rng, 0, 0.25)).toFixed(1)))
    time.push(t)
    distance.push(Number(d.toFixed(1)))
    velocity.push(paused ? 0 : Number(speed.toFixed(3)))
    moving.push(paused ? 0 : 1)

    if (persona.hasHr) {
      // First-order lag toward the segment's HR target — gives interval
      // sawtooth and race drift for free.
      const effortFrac =
        seg.hrFrac !== undefined && seg.hrFrac >= 0
          ? seg.hrFrac
          : hrEffortFrac(persona, plan.type, plan.km, fitness)
      const drift =
        plan.type === 'long' || plan.type === 'race' ? 0.06 * progress : 0
      const target = paused
        ? hrModel.value - 6
        : persona.hrRest +
          (effortFrac + drift) * (persona.hrMax - persona.hrRest)
      hrModel.value += ((target - hrModel.value) * dt) / 45 + gaussian(rng, 0, 0.8)
      heartrate.push(
        Math.round(
          Math.min(persona.hrMax, Math.max(persona.hrRest, hrModel.value)),
        ),
      )
    }
    if (persona.hasCadence) {
      const spm = paused
        ? 0
        : cadenceBase * Math.pow(easyPace / paceNow, 0.35) +
          gaussian(rng, 0, 1.2)
      cadence.push(Number((spm / 2).toFixed(1)))
    }

    if (t > 6 * 3600) break // safety valve
  }

  const elapsedTime = t
  const movingTime = elapsedTime - pausedSeconds
  const totalMeters = distance[distance.length - 1]

  // Aggregates.
  const movingSpeeds = velocity.filter((v) => v > 0)
  const averageSpeed = totalMeters / movingTime
  const maxSpeed = Math.max(...movingSpeeds) * uniform(rng, 1.02, 1.08)
  const avgHr = persona.hasHr
    ? Math.round(heartrate.reduce((a, b) => a + b, 0) / heartrate.length)
    : null
  const maxHr = persona.hasHr ? Math.max(...heartrate) : null
  const avgCadenceRpm = persona.hasCadence
    ? Number(
        (
          cadence.filter((c) => c > 0).reduce((a, b) => a + b, 0) /
          cadence.filter((c) => c > 0).length
        ).toFixed(1),
      )
    : null

  // Elevation gain: positive deltas of the noise-free profile only.
  let gain = 0
  for (let i = 1; i < cleanElevation.length; i++) {
    const delta = cleanElevation[i] - cleanElevation[i - 1]
    if (delta > 0) gain += delta
  }

  const splitsMetric = buildSplits(1000, time, distance, moving, altitude, heartrate, dt)
  const splitsStandard = buildSplits(1609.34, time, distance, moving, altitude, heartrate, dt)
  // Laps take the clean profile — their gain must not sum GPS noise either.
  const laps = buildLaps(plan, segments, time, distance, heartrate, cleanElevation)

  // Start time / dates.
  const hourF = startHourFor(persona, plan.type, runDate.dow, runDate.mo, rng)
  const h = Math.floor(hourF)
  const mi = Math.floor((hourF - h) * 60)
  const s = Math.floor(uniform(rng, 0, 59))
  const startDateLocal = formatLocal(runDate.y, runDate.mo, runDate.d, h, mi, s)
  const startDate = new Date(
    Date.UTC(
      runDate.y,
      runDate.mo,
      runDate.d,
      h + utcOffsetHours(runDate.mo),
      mi,
      s,
    ),
  )

  const hrr = avgHr !== null ? (avgHr - persona.hrRest) / (persona.hrMax - persona.hrRest) : 0
  const sufferScore =
    avgHr !== null ? Math.round(hrr * hrr * (movingTime / 60) * 2.4) : null

  return {
    week,
    type: plan.type,
    routeKey: route.key,
    name: nameFor(plan, route, h, rng, repCount),
    startDate,
    startDateLocal,
    distance: Number(totalMeters.toFixed(1)),
    movingTime,
    elapsedTime,
    totalElevationGain: Number(gain.toFixed(1)),
    averageSpeed: Number(averageSpeed.toFixed(3)),
    maxSpeed: Number(maxSpeed.toFixed(3)),
    averageHeartrate: avgHr,
    maxHeartrate: maxHr,
    averageCadence: avgCadenceRpm,
    workoutType:
      persona.deviceName === null
        ? null
        : plan.type === 'race'
          ? 1
          : plan.type === 'long'
            ? 2
            : plan.type === 'tempo' || plan.type === 'intervals'
              ? 3
              : 0,
    calories: Math.round(
      (totalMeters / 1000) * persona.weightKg * 1.036 * uniform(rng, 0.95, 1.05),
    ),
    sufferScore,
    deviceName: persona.deviceName ?? 'Strava iPhone App',
    elevHigh: Number(Math.max(...altitude).toFixed(1)),
    elevLow: Number(Math.min(...altitude).toFixed(1)),
    streams: {
      time,
      distance,
      latlng,
      altitude,
      velocity_smooth: velocity,
      moving,
      ...(persona.hasHr ? { heartrate } : {}),
      ...(persona.hasCadence ? { cadence } : {}),
    },
    splitsMetric,
    splitsStandard,
    laps,
    bestEffortTimes: Object.fromEntries(
      STRAVA_EFFORT_DISTANCES.flatMap(([name, target]) => {
        const seconds = bestSplitSeconds(distance, time, target)
        return seconds === null ? [] : [[name, seconds]]
      }),
    ),
    gearId: pickGear(persona, plan.type, week, rng),
  }
}

function buildSplits(
  unitMeters: number,
  time: number[],
  distance: number[],
  moving: number[],
  altitude: number[],
  heartrate: number[],
  dt: number,
): SplitRow[] {
  const splits: SplitRow[] = []
  const total = distance[distance.length - 1]
  let splitStart = 0 // index
  let splitNo = 1
  for (let i = 1; i < distance.length; i++) {
    const boundary = splitNo * unitMeters
    const isLast = i === distance.length - 1
    if (distance[i] >= boundary || isLast) {
      const segMeters = distance[i] - distance[splitStart]
      if (segMeters < unitMeters * 0.08 && splits.length > 0) break // ignore dust
      const elapsed = time[i] - time[splitStart]
      let pausedInSplit = 0
      for (let j = splitStart; j <= i; j++) {
        if (moving[j] === 0) pausedInSplit += dt
      }
      const movingTime = elapsed - pausedInSplit
      const hrSlice = heartrate.slice(splitStart, i + 1)
      splits.push({
        split: splitNo,
        distance: Number(segMeters.toFixed(1)),
        elapsed_time: elapsed,
        moving_time: movingTime,
        average_speed: Number((segMeters / movingTime).toFixed(3)),
        elevation_difference: Number(
          (altitude[i] - altitude[splitStart]).toFixed(1),
        ),
        ...(hrSlice.length > 0
          ? {
              average_heartrate: Math.round(
                hrSlice.reduce((a, b) => a + b, 0) / hrSlice.length,
              ),
            }
          : {}),
        pace_zone: 0,
      })
      splitStart = i
      splitNo++
      if (boundary >= total && isLast) break
    }
  }
  return splits
}

function buildLaps(
  plan: PlannedRun,
  segments: Segment[],
  time: number[],
  distance: number[],
  heartrate: number[],
  altitude: number[],
): LapRow[] {
  const mkLap = (
    lapIndex: number,
    name: string,
    startIdx: number,
    endIdx: number,
  ): LapRow => {
    const meters = distance[endIdx] - distance[startIdx]
    const secs = Math.max(1, time[endIdx] - time[startIdx])
    const hrSlice = heartrate.slice(startIdx, endIdx + 1)
    let gain = 0
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const delta = altitude[i] - altitude[i - 1]
      if (delta > 0) gain += delta
    }
    return {
      lap_index: lapIndex,
      name,
      distance: Number(meters.toFixed(1)),
      elapsed_time: secs,
      moving_time: secs,
      average_speed: Number((meters / secs).toFixed(3)),
      start_index: startIdx,
      end_index: endIdx,
      ...(hrSlice.length > 0
        ? {
            average_heartrate: Math.round(
              hrSlice.reduce((a, b) => a + b, 0) / hrSlice.length,
            ),
          }
        : {}),
      total_elevation_gain: Number(gain.toFixed(1)),
    }
  }

  if (plan.type !== 'intervals') {
    return [mkLap(1, 'Lap 1', 0, distance.length - 1)]
  }

  // One lap per structured segment (WU / reps / jogs / CD).
  const laps: LapRow[] = []
  let startIdx = 0
  let boundary = 0
  segments.forEach((seg, i) => {
    boundary += seg.meters
    let endIdx = startIdx
    while (endIdx < distance.length - 1 && distance[endIdx] < boundary) endIdx++
    laps.push(mkLap(i + 1, `Lap ${i + 1}`, startIdx, endIdx))
    startIdx = endIdx
  })
  return laps
}

// ── Calendar assembly ────────────────────────────────────────────────────

/**
 * Generate a persona's full run history, oldest first, anchored so the
 * final week ends at `endDate` (exclusive of future days).
 */
export function generatePersonaRuns(
  persona: PersonaConfig,
  endDate: Date,
  rng: Rng,
): GeneratedRun[] {
  const runs: GeneratedRun[] = []
  const DAY = 24 * 3600 * 1000

  // Monday of the current week, local-ish (UTC date math is fine here).
  const end = new Date(endDate)
  const dow = (end.getDay() + 6) % 7 // 0 = Monday
  const currentMonday = new Date(end.getTime() - dow * DAY)

  for (let week = 0; week < persona.weeks; week++) {
    if (persona.gapWeeks.includes(week)) continue
    const monday = new Date(
      currentMonday.getTime() - (persona.weeks - 1 - week) * 7 * DAY,
    )
    const plans = persona.weekPlan(week, rng)

    // A race on a given day preempts anything else planned that day.
    const raceDays = new Set(
      plans.filter((p) => p.type === 'race').map((p) => p.day),
    )
    const deduped = plans.filter(
      (p) => p.type === 'race' || !raceDays.has(p.day),
    )

    // Real schedules drift: runs slide ±1 day onto rest days (quality
    // days are stickier than easy days; races never move). Pre-seeding
    // `used` with every planned day means drift only lands on genuinely
    // free days — no accidental doubles — and it's what populates the
    // otherwise-dead Mondays a rigid template would leave.
    const used = new Set(deduped.map((p) => p.day))
    const drifted = deduped.map((p) => {
      if (p.type === 'race') return p
      const driftProb =
        p.type === 'tempo' || p.type === 'intervals'
          ? 0.18
          : p.type === 'long'
            ? 0.25
            : 0.38
      if (!chance(rng, driftProb)) return p
      const candidate = Math.min(
        6,
        Math.max(0, p.day + (chance(rng, 0.5) ? -1 : 1)),
      )
      if (candidate === p.day || used.has(candidate)) return p
      used.delete(p.day)
      used.add(candidate)
      return { ...p, day: candidate }
    })

    for (const plan of drifted) {
      if (plan.type !== 'race' && chance(rng, persona.skipChance)) continue
      const date = new Date(monday.getTime() + plan.day * DAY)
      if (date.getTime() > endDate.getTime()) continue
      runs.push(
        synthesizeRun(persona, plan, week, {
          y: date.getFullYear(),
          mo: date.getMonth(),
          d: date.getDate(),
          dow: plan.day,
        }, rng),
      )
    }
  }

  runs.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  return runs
}
