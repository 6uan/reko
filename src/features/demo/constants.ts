/**
 * Demo persona registry — client-safe (no server imports).
 *
 * Single source of truth for the demo athlete IDs: the seeder
 * (scripts/demo/personas.ts) creates users with these stable Strava
 * athlete IDs, and the demo session (session.server.ts) looks users up
 * by them — never by serial users.id, which changes on every reseed.
 */

export type DemoPersona = {
  key: 'project' | 'machine' | 'newrunner'
  /** Display name in the persona switcher. */
  label: string
  /** One-line pitch shown under the label. */
  blurb: string
  /** users.strava_athlete_id of the seeded demo user. */
  athleteId: number
}

// Ordered by runner progression (least → most data); the banner pills
// render in this order.
export const DEMO_PERSONAS: DemoPersona[] = [
  {
    key: 'newrunner',
    label: 'The New Runner',
    blurb: '10 weeks in, phone in hand',
    athleteId: 999_000_103,
  },
  {
    key: 'project',
    label: 'The Project',
    blurb: '18 months from first jog to half marathon',
    athleteId: 999_000_101,
  },
  {
    key: 'machine',
    label: 'The Machine',
    blurb: '70 km weeks, two marathon builds',
    athleteId: 999_000_102,
  },
]

export type DemoPersonaKey = DemoPersona['key']

export const DEFAULT_DEMO_PERSONA: DemoPersonaKey = 'project'
