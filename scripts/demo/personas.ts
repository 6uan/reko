/**
 * Demo personas — the WHAT of the seeder.
 *
 * Each persona owns its training calendar, pace/HR physiology, gear
 * plan, and race schedule. The generator (generator.ts) turns a
 * persona's planned runs into streams + activity rows; it knows HOW a
 * run looks, personas decide WHAT was run.
 *
 * The three personas deliberately span the data spectrum:
 *   - project:   18-month improvement arc, full sensor data (the default)
 *   - machine:   high-volume marathoner, dense everything
 *   - newrunner: 10 weeks, phone-only (no HR / cadence / gear) — the
 *                sparse/empty-state showcase
 *
 * HR effort fractions are calibrated to the app's fixed zone bands
 * (src/lib/heartRate.ts): Z2 124–143, Z3 143–162, Z4 162–181, Z5 181+.
 */

import { DEMO_PERSONAS } from '../../src/features/demo/constants.ts'
import { chance, gaussian, uniform, type Rng } from './rng.ts'

/** Stable athlete IDs shared with the app's demo session — never inline them. */
const ATHLETE_ID = Object.fromEntries(
  DEMO_PERSONAS.map((p) => [p.key, p.athleteId]),
) as Record<'project' | 'machine' | 'newrunner', number>

export type RunType =
  | 'easy'
  | 'recovery'
  | 'long'
  | 'tempo'
  | 'intervals'
  | 'race'

export type PlannedRun = {
  /** 0 = Monday … 6 = Sunday, within the plan week. */
  day: number
  type: RunType
  km: number
  raceName?: string
}

export type GearPlan = {
  id: string
  name: string
  brandName: string
  modelName: string
  /** Weeks (inclusive) this shoe is in rotation. */
  fromWeek: number
  toWeek: number
  /** Run types this shoe is preferred for; empty = everything. */
  forTypes: RunType[]
  isPrimary: boolean
  retired: boolean
  /** Kilometers already on the shoe before this history window. */
  priorKm: number
}

export type PersonaConfig = {
  key: string
  stravaAthleteId: number
  firstname: string
  lastname: string
  weeks: number
  weightKg: number
  /** null = phone recording (no HR / cadence streams). */
  deviceName: string | null
  hasHr: boolean
  hasCadence: boolean
  hrMax: number
  hrRest: number
  /** Fitness 0..1 given timeline fraction 0..1. */
  fitnessAt: (frac: number) => number
  /** Easy pace in seconds/km at a given fitness. */
  easyPaceAt: (fitness: number) => number
  /** Effort as a fraction of heart-rate reserve for an easy run. */
  easyHrFracAt: (fitness: number) => number
  /** Cadence in steps/min at a given fitness. */
  cadenceSpmAt: (fitness: number) => number
  /** Per-run-type route weighting: route key → weight. */
  routeWeights: Partial<Record<RunType, Array<[string, number]>>>
  /** Chance a planned run silently doesn't happen. */
  skipChance: number
  /** Whole weeks with no running at all (vacation, sick, life). */
  gapWeeks: number[]
  gear: GearPlan[]
  /** The week's planned runs. Race weeks include the race itself. */
  weekPlan: (week: number, rng: Rng) => PlannedRun[]
}

// ── The Project — improving half-marathoner (default persona) ────────────

const PROJECT_WEEKS = 78
const PROJECT_RACES: Array<{ week: number; km: number; name: string }> = [
  { week: 20, km: 5, name: 'Sunset 5K' },
  { week: 47, km: 10, name: 'Turkey Trot 10K' },
  { week: 75, km: 21.0975, name: 'Miami Half Marathon' },
]

const project: PersonaConfig = {
  key: 'project',
  stravaAthleteId: ATHLETE_ID.project,
  firstname: 'Alex',
  lastname: 'Rivera',
  weeks: PROJECT_WEEKS,
  weightKg: 74,
  deviceName: 'Garmin Forerunner 255',
  hasHr: true,
  hasCadence: true,
  hrMax: 192,
  hrRest: 58,
  // Fast early gains, diminishing returns.
  fitnessAt: (frac) => (1 - Math.exp(-2.2 * frac)) / (1 - Math.exp(-2.2)),
  // 6:45/km → 5:25/km over the arc.
  easyPaceAt: (fit) => 405 - 80 * fit,
  // Unfit easy runs sit in Z3; trained ones drop into Z2 — the
  // "same effort, cheaper" story the HR tab tells.
  easyHrFracAt: (fit) => 0.7 - 0.1 * fit,
  cadenceSpmAt: (fit) => 162 + 14 * fit,
  routeWeights: {
    easy: [
      ['brickellBaywalk', 5],
      ['southBeach', 3],
      ['oldCutler', 2],
    ],
    recovery: [
      ['brickellBaywalk', 7],
      ['southBeach', 3],
    ],
    long: [
      ['rickenbacker', 6],
      ['oldCutler', 4],
    ],
    tempo: [
      ['southBeach', 5],
      ['brickellBaywalk', 3],
      ['oldCutler', 2],
    ],
    intervals: [['tropicalParkTrack', 1]],
    race: [['rickenbacker', 1]],
  },
  skipChance: 0.12,
  gapWeeks: [30, 31], // beach vacation
  gear: [
    {
      id: 'g999001011',
      name: 'Nike Pegasus 40',
      brandName: 'Nike',
      modelName: 'Pegasus 40',
      fromWeek: 0,
      toWeek: 45,
      forTypes: [],
      isPrimary: false,
      retired: true,
      priorKm: 210,
    },
    {
      id: 'g999001012',
      name: 'Nike Pegasus 41',
      brandName: 'Nike',
      modelName: 'Pegasus 41',
      fromWeek: 40,
      toWeek: PROJECT_WEEKS,
      forTypes: [],
      isPrimary: true,
      retired: false,
      priorKm: 0,
    },
    {
      id: 'g999001013',
      name: 'Saucony Endorphin Speed 4',
      brandName: 'Saucony',
      modelName: 'Endorphin Speed 4',
      fromWeek: 58,
      toWeek: PROJECT_WEEKS,
      forTypes: ['tempo', 'intervals', 'race'],
      isPrimary: false,
      retired: false,
      priorKm: 0,
    },
  ],
  weekPlan: (week, rng) => {
    const frac = week / PROJECT_WEEKS
    const race = PROJECT_RACES.find((r) => r.week === week)
    const weeksToRace = Math.min(
      ...PROJECT_RACES.filter((r) => r.week >= week).map((r) => r.week - week),
    )
    // Taper the week before a race, recover the week after.
    const postRace = PROJECT_RACES.some((r) => week === r.week + 1)
    const scale = race || weeksToRace === 1 ? 0.6 : postRace ? 0.55 : 1

    const plan: PlannedRun[] = []
    const easyKm = () =>
      Math.max(3, gaussian(rng, (4 + 4 * frac) * scale, 1.1))

    // Tue: intervals late in the arc, tempo mid-arc, easy early.
    if (frac > 0.78 && !race) {
      plan.push({ day: 1, type: 'intervals', km: 7 })
    } else if (frac > 0.55 && !race) {
      plan.push({ day: 1, type: 'tempo', km: (6 + 3 * frac) * scale })
    } else {
      plan.push({ day: 1, type: 'easy', km: easyKm() })
    }

    plan.push({ day: 3, type: 'easy', km: easyKm() }) // Thu
    if (frac > 0.5) plan.push({ day: 2, type: 'easy', km: easyKm() }) // Wed

    plan.push({ day: 5, type: 'easy', km: easyKm() }) // Sat

    if (race) {
      plan.push({ day: 6, type: 'race', km: race.km, raceName: race.name })
    } else if (frac > 0.15) {
      const longKm = Math.min(19, 8 + 12 * ((frac - 0.15) / 0.85))
      plan.push({
        day: 6,
        type: 'long',
        km: Math.max(7, gaussian(rng, longKm * scale, 1.4)),
      })
    }
    return plan
  },
}

// ── The Machine — high-volume marathoner ────────────────────────────────

const MACHINE_WEEKS = 78
const MACHINE_RACES: Array<{ week: number; km: number; name: string }> = [
  { week: 20, km: 21.0975, name: 'Palm Beaches Half' },
  { week: 26, km: 42.195, name: 'A1A Marathon' },
  { week: 68, km: 21.0975, name: 'Key Biscayne Half' },
  { week: 74, km: 42.195, name: 'Miami Marathon' },
]

/** Weekly volume (km): two marathon blocks with build → taper → recover. */
function machineWeeklyKm(week: number, rng: Rng): number {
  for (const race of MACHINE_RACES.filter((r) => r.km > 42)) {
    const toRace = race.week - week
    if (toRace >= 0 && toRace <= 15) {
      if (toRace === 0) return 30 // race week: shakeouts + the race itself
      if (toRace === 1) return 62
      if (toRace === 2) return 80
      return 105 - 2.2 * (toRace - 3) // 105 at peak, ~78 early block
    }
    const sinceRace = week - race.week
    if (sinceRace === 1) return 38
    if (sinceRace === 2) return 55
  }
  return uniform(rng, 66, 78)
}

const machine: PersonaConfig = {
  key: 'machine',
  stravaAthleteId: ATHLETE_ID.machine,
  firstname: 'Marta',
  lastname: 'Kowalski',
  weeks: MACHINE_WEEKS,
  weightKg: 58,
  deviceName: 'COROS PACE 3',
  hasHr: true,
  hasCadence: true,
  hrMax: 178,
  hrRest: 44,
  fitnessAt: (frac) => 0.8 + 0.2 * frac,
  // Already trained: 5:40 → 5:28/km easy.
  easyPaceAt: (fit) => 340 - 15 * fit,
  easyHrFracAt: () => 0.63, // ~128–135 bpm, squarely Z2
  cadenceSpmAt: (fit) => 176 + 2 * fit,
  routeWeights: {
    easy: [
      ['oldCutler', 4],
      ['brickellBaywalk', 3],
      ['southBeach', 3],
    ],
    recovery: [
      ['brickellBaywalk', 6],
      ['oldCutler', 4],
    ],
    long: [
      ['rickenbacker', 5],
      ['oldCutler', 5],
    ],
    tempo: [
      ['southBeach', 5],
      ['rickenbacker', 5],
    ],
    intervals: [['tropicalParkTrack', 1]],
    race: [['rickenbacker', 1]],
  },
  skipChance: 0.07,
  gapWeeks: [33, 56], // flu week + work-travel week — even machines are human
  gear: [
    {
      id: 'g999001021',
      name: 'Brooks Ghost 15',
      brandName: 'Brooks',
      modelName: 'Ghost 15',
      fromWeek: 0,
      toWeek: 18,
      forTypes: [],
      isPrimary: false,
      retired: true,
      priorKm: 520,
    },
    {
      id: 'g999001022',
      name: 'Brooks Ghost 16',
      brandName: 'Brooks',
      modelName: 'Ghost 16',
      fromWeek: 14,
      toWeek: 54,
      forTypes: [],
      isPrimary: false,
      retired: true,
      priorKm: 0,
    },
    {
      id: 'g999001023',
      name: 'Brooks Ghost 17',
      brandName: 'Brooks',
      modelName: 'Ghost 17',
      fromWeek: 50,
      toWeek: MACHINE_WEEKS,
      forTypes: [],
      isPrimary: true,
      retired: false,
      priorKm: 0,
    },
    {
      id: 'g999001024',
      name: 'Adidas Adizero Adios Pro 3',
      brandName: 'Adidas',
      modelName: 'Adizero Adios Pro 3',
      fromWeek: 0,
      toWeek: MACHINE_WEEKS,
      forTypes: ['tempo', 'race'],
      isPrimary: false,
      retired: false,
      priorKm: 105,
    },
  ],
  weekPlan: (week, rng) => {
    const weeklyKm = machineWeeklyKm(week, rng)
    const race = MACHINE_RACES.find((r) => r.week === week)
    const longKm = race ? 0 : weeklyKm * uniform(rng, 0.28, 0.33)
    const tempoKm = weeklyKm * 0.16
    const rest = weeklyKm - longKm - tempoKm - (race?.km ?? 0)
    const easyKm = Math.max(6, rest / 4)

    const plan: PlannedRun[] = [
      { day: 1, type: 'tempo', km: tempoKm },
      { day: 2, type: 'easy', km: easyKm },
      { day: 3, type: 'easy', km: easyKm * 1.25 },
      { day: 4, type: 'recovery', km: Math.max(5, easyKm * 0.75) },
    ]
    if (race) {
      plan.push({ day: 6, type: 'race', km: race.km, raceName: race.name })
    } else {
      plan.push({ day: 5, type: 'long', km: longKm })
      // Post-long-run recovery floats between Sunday and Monday — the
      // classic marathoner pattern, and it keeps Mondays alive.
      plan.push({
        day: chance(rng, 0.4) ? 0 : 6,
        type: 'recovery',
        km: easyKm,
      })
    }
    return plan
  },
}

// ── The New Runner — sparse, phone-only (the empty-state showcase) ──────

const NEWRUNNER_WEEKS = 10

const newrunner: PersonaConfig = {
  key: 'newrunner',
  stravaAthleteId: ATHLETE_ID.newrunner,
  firstname: 'Sam',
  lastname: 'Chen',
  weeks: NEWRUNNER_WEEKS,
  weightKg: 81,
  deviceName: null, // phone in an armband
  hasHr: false,
  hasCadence: false,
  hrMax: 195, // unused (no HR data) but keeps the model total
  hrRest: 62,
  fitnessAt: (frac) => frac,
  // 7:15 → 6:50/km — real but modest gains.
  easyPaceAt: (fit) => 435 - 25 * fit,
  easyHrFracAt: () => 0.72,
  cadenceSpmAt: () => 158,
  routeWeights: {
    easy: [
      ['brickellBaywalk', 6],
      ['southBeach', 4],
    ],
    race: [['southBeach', 1]],
  },
  skipChance: 0.25,
  gapWeeks: [4], // fell off the wagon for a week
  gear: [],
  weekPlan: (week, rng) => {
    const plan: PlannedRun[] = [
      { day: 5, type: 'easy', km: Math.max(2.2, gaussian(rng, 4, 1.1)) },
      { day: 6, type: 'easy', km: Math.max(2.2, gaussian(rng, 4.4, 1.2)) },
    ]
    if (chance(rng, 0.5)) {
      plan.push({ day: 2, type: 'easy', km: Math.max(2.2, gaussian(rng, 3.4, 0.9)) })
    }
    if (week === 8) {
      plan.push({ day: 6, type: 'race', km: 5, raceName: 'Corporate Run 5K' })
    }
    return plan
  },
}

export const PERSONAS: PersonaConfig[] = [project, machine, newrunner]
