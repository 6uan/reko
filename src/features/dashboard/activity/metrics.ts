/**
 * Pure, unit-free per-activity metrics derived from Strava streams.
 *
 * Everything here is a pure function over plain number arrays so it can be
 * unit-tested in isolation (see metrics.test.ts) and reused on the server
 * without dragging in DB / React / unit-formatting concerns. Callers pass
 * SI inputs (meters, seconds, m/s, bpm, grade %); formatting to km/mi lives
 * in the component layer.
 *
 * Channels can be ABSENT — every consumer guards per-sample so a missing or
 * sparse channel degrades gracefully instead of producing NaN.
 */

import { HR_ZONES, zoneFor, type HrZoneName } from '@/lib/heartRate'
import { speedToPaceSeconds } from '@/lib/strava'

// ── Types ──────────────────────────────────────────────────────────

/**
 * Full-resolution, index-aligned stream channels. `time` + `distance` are
 * the anchors; the rest are optional and may be undefined when Strava
 * didn't record that sensor. `velocity` is `velocity_smooth` (m/s) and
 * `grade` is `grade_smooth` (percent).
 */
export type StreamChannels = {
  time: number[]
  distance: number[]
  altitude?: number[]
  velocity?: number[]
  heartrate?: number[]
  cadence?: number[]
  grade?: number[]
}

/** One downsampled chart row. Optional fields drop out when absent. */
export type SeriesRow = {
  /** Elapsed seconds (time stream). */
  t: number
  /** Cumulative distance, meters. */
  distM: number
  /** Altitude, meters. */
  elev?: number
  /** Heart rate, bpm. */
  hr?: number
  /** Raw cadence, RPM (the UI doubles to spm). */
  cad?: number
  /** Instantaneous pace, seconds per km. Absent while paused (v≈0). */
  paceSecPerKm?: number
  /** Grade-adjusted instantaneous pace, seconds per km. Needs grade + pace. */
  gapPaceSecPerKm?: number
  /** Grade, percent (grade_smooth). */
  grade?: number
}

export type GapResult = {
  rawPaceSecPerKm: number | null
  gapPaceSecPerKm: number | null
}

/** Discriminated so callers can't read `pct` when it's meaningless. */
export type Decoupling = { applicable: false } | { applicable: true; pct: number }

export type ZonePercents = Record<HrZoneName, number>

// ── Internal helpers ───────────────────────────────────────────────

function isNum(x: number | undefined): x is number {
  return typeof x === 'number' && Number.isFinite(x)
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
}

/** std/mean — 0 when mean is 0. Used to flag interval-style variability. */
function coefficientOfVariation(xs: number[]): number {
  const m = mean(xs)
  if (m === 0) return 0
  const variance = mean(xs.map((x) => (x - m) ** 2))
  return Math.sqrt(variance) / m
}

/**
 * Indices to sample for a ≤`target`-length series. Strides evenly and
 * always keeps the first and last index so chart endpoints match the run.
 */
function strideIndices(n: number, target: number): number[] {
  if (n <= target) return Array.from({ length: n }, (_, i) => i)
  const stride = Math.ceil(n / target)
  const out: number[] = []
  for (let i = 0; i < n; i += stride) out.push(i)
  // Replace (not append) the tail with the true last sample so we preserve
  // the endpoint without ever exceeding `target`.
  if (out[out.length - 1] !== n - 1) out[out.length - 1] = n - 1
  return out
}

// ── Grade adjustment (Minetti 2002) ────────────────────────────────

/** Gradient clamp (±35%) — guards against bad grade_smooth samples. */
const GRADE_CLAMP = 0.35
/** Minetti running cost at i=0 (the polynomial's constant term). */
const FLAT_COST = 3.6

/** Minetti (2002) energetic cost of running, J/kg/m, for gradient i (decimal). */
function minettiCost(i: number): number {
  return (
    155.4 * i ** 5 -
    30.4 * i ** 4 -
    43.3 * i ** 3 +
    46.3 * i ** 2 +
    19.5 * i +
    3.6
  )
}

/**
 * Grade-adjustment factor C(i)/C(0) for a grade in PERCENT.
 * >1 uphill (costs more → equivalent flat pace is faster), <1 downhill.
 */
export function gradeFactor(gradePercent: number): number {
  const i = Math.max(-GRADE_CLAMP, Math.min(GRADE_CLAMP, gradePercent / 100))
  return minettiCost(i) / FLAT_COST
}

// ── buildSeries ────────────────────────────────────────────────────

/**
 * Downsample aligned streams to ≤`target` rows for charting. Stats must be
 * computed on the FULL-resolution arrays, not on this output.
 */
export function buildSeries(s: StreamChannels, target = 500): SeriesRow[] {
  const n = Math.min(s.time.length, s.distance.length)
  if (n === 0) return []
  const t = target < 1 ? 1 : target

  return strideIndices(n, t).map((i) => {
    const row: SeriesRow = { t: s.time[i], distM: s.distance[i] }

    const elev = s.altitude?.[i]
    if (isNum(elev)) row.elev = elev

    const hr = s.heartrate?.[i]
    if (isNum(hr)) row.hr = hr

    const cad = s.cadence?.[i]
    if (isNum(cad)) row.cad = cad

    const v = s.velocity?.[i]
    if (isNum(v) && v > 0) row.paceSecPerKm = speedToPaceSeconds(v)

    const g = s.grade?.[i]
    if (isNum(g)) {
      row.grade = g
      if (row.paceSecPerKm !== undefined) {
        row.gapPaceSecPerKm = row.paceSecPerKm / gradeFactor(g)
      }
    }

    return row
  })
}

// ── timeInZones ────────────────────────────────────────────────────

function emptyZones(): ZonePercents {
  return {
    'Z1 Recovery': 0,
    'Z2 Aerobic': 0,
    'Z3 Tempo': 0,
    'Z4 Threshold': 0,
    'Z5 VO₂max': 0,
  }
}

/**
 * Percentage of in-run time spent in each HR zone. Each inter-sample
 * interval is attributed to the zone of its starting HR sample (via
 * `zoneFor`), so the result reuses the canonical zone boundaries.
 */
export function timeInZones(hr: number[], time: number[]): ZonePercents {
  const secs = emptyZones()
  const n = Math.min(hr.length, time.length)
  let total = 0

  for (let i = 1; i < n; i++) {
    const dt = time[i] - time[i - 1]
    if (!(dt > 0)) continue
    const h = hr[i - 1]
    if (!isNum(h)) continue
    secs[zoneFor(h).name] += dt
    total += dt
  }

  const pct = emptyZones()
  if (total > 0) {
    for (const z of HR_ZONES) pct[z.name] = (secs[z.name] / total) * 100
  }
  return pct
}

// ── gradeAdjustedPace ──────────────────────────────────────────────

/**
 * Raw and grade-adjusted pace for the whole activity (sec/km).
 *
 * Per sample, equivalent-flat speed = actual speed × C(i)/C(0). We take the
 * distance-weighted mean of those equivalent-flat speeds and convert to a
 * single pace. Uphill segments cost more → equivalent-flat speed is faster
 * → GAP is faster than raw. Sample speed comes from `velocity` when present,
 * else from Δdistance/Δtime.
 */
export function gradeAdjustedPace(
  distance: number[],
  time: number[],
  grade: number[],
  velocity?: number[],
): GapResult {
  const n = Math.min(distance.length, time.length)
  if (n < 2) return { rawPaceSecPerKm: null, gapPaceSecPerKm: null }

  const totalDist = distance[n - 1] - distance[0]
  const totalTime = time[n - 1] - time[0]
  const rawPaceSecPerKm =
    totalDist > 0 && totalTime > 0 ? (totalTime * 1000) / totalDist : null

  let sumW = 0
  let sumWV = 0
  for (let i = 1; i < n; i++) {
    const dd = distance[i] - distance[i - 1]
    const dt = time[i] - time[i - 1]
    if (!(dd > 0) || !(dt > 0)) continue
    const vi = velocity?.[i]
    const v = isNum(vi) ? vi : dd / dt
    const gi = grade[i]
    const vEq = v * gradeFactor(isNum(gi) ? gi : 0)
    sumW += dd
    sumWV += vEq * dd
  }

  const gapSpeed = sumW > 0 ? sumWV / sumW : 0
  const gapPaceSecPerKm = gapSpeed > 0 ? 1000 / gapSpeed : null
  return { rawPaceSecPerKm, gapPaceSecPerKm }
}

// ── aerobicDecoupling ──────────────────────────────────────────────

/** Minimum moving time for decoupling to be meaningful (45 min). */
const MIN_DECOUPLE_SECONDS = 45 * 60
/** Samples slower than this (m/s) are treated as paused and dropped. */
const PAUSE_SPEED = 0.5
/** Speed coefficient-of-variation above this ⇒ interval-style, not steady. */
const INTERVAL_CV = 0.2

/**
 * Aerobic decoupling: how much efficiency (speed per heartbeat) drifts from
 * the first half of the run to the second. EF = mean(speed)/mean(HR) per
 * half; decoupling% = (EF₁ − EF₂)/EF₁ × 100 (positive = HR drifted up).
 *
 * Only meaningful for long, steady runs, so it's marked `applicable:false`
 * when HR is absent, the run is under 45 min, or speed variability looks
 * interval-like. Paused samples (v≈0) are dropped before everything.
 */
export function aerobicDecoupling(
  distance: number[],
  time: number[],
  hr: number[],
  velocity?: number[],
): Decoupling {
  const n = Math.min(distance.length, time.length, hr.length)
  if (n < 4) return { applicable: false }
  if (time[n - 1] - time[0] < MIN_DECOUPLE_SECONDS) return { applicable: false }

  // Moving samples only: { time, speed, hr }.
  const moving: Array<{ t: number; v: number; hr: number }> = []
  for (let i = 1; i < n; i++) {
    const dd = distance[i] - distance[i - 1]
    const dt = time[i] - time[i - 1]
    if (!(dt > 0)) continue
    const vi = velocity?.[i]
    const v = isNum(vi) ? vi : dd / dt
    if (!(v >= PAUSE_SPEED)) continue
    if (!isNum(hr[i])) continue
    moving.push({ t: time[i], v, hr: hr[i] })
  }
  if (moving.length < 4) return { applicable: false }

  // Interval guard: surging speed isn't a steady aerobic effort.
  if (coefficientOfVariation(moving.map((m) => m.v)) > INTERVAL_CV) {
    return { applicable: false }
  }

  const midT = (time[0] + time[n - 1]) / 2
  const first = moving.filter((m) => m.t <= midT)
  const second = moving.filter((m) => m.t > midT)
  if (first.length === 0 || second.length === 0) return { applicable: false }

  const ef1 = mean(first.map((m) => m.v)) / mean(first.map((m) => m.hr))
  const ef2 = mean(second.map((m) => m.v)) / mean(second.map((m) => m.hr))
  if (!(ef1 > 0)) return { applicable: false }

  return { applicable: true, pct: ((ef1 - ef2) / ef1) * 100 }
}
