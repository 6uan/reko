const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token'
const STRAVA_API = 'https://www.strava.com/api/v3'

// ── Types ──────────────────────────────────────────────────────────

export type StravaActivity = {
  id: number
  name: string
  type: string
  sport_type: string
  distance: number // meters
  moving_time: number // seconds
  elapsed_time: number // seconds
  total_elevation_gain: number // meters
  start_date: string // ISO UTC
  start_date_local: string // ISO local
  average_speed: number // m/s
  max_speed: number // m/s
  average_heartrate?: number // bpm
  max_heartrate?: number // bpm
  average_cadence?: number // RPM — multiply by 2 for steps/min
  pr_count: number
  achievement_count: number
  has_heartrate: boolean
}

/**
 * Per-distance split inside a DetailedActivity. Strava precomputes these
 * for standard distances (1k, 1mi, 5k, 10k, Half-Marathon, Marathon).
 *   pr_rank: 1 = current PR, 2 = 2nd-best, 3 = 3rd-best, null = not on the
 *   user's all-time leaderboard for that distance.
 */
export type StravaBestEffort = {
  id: number
  resource_state: number
  name: string
  elapsed_time: number
  moving_time: number
  start_date: string
  start_date_local: string
  distance: number
  pr_rank: number | null
  achievements?: unknown[]
}

/** GET /activities/{id} — superset of the list-endpoint payload. */
export type StravaActivityDetail = StravaActivity & {
  best_efforts?: StravaBestEffort[]
  description?: string | null
  calories?: number
}

/** Stream channels we know about. Mirrors `streamTypeEnum` in the DB. */
export const STRAVA_STREAM_TYPES = [
  'time',
  'distance',
  'latlng',
  'altitude',
  'velocity_smooth',
  'heartrate',
  'cadence',
  'watts',
  'temp',
  'moving',
  'grade_smooth',
] as const
export type StravaStreamType = (typeof STRAVA_STREAM_TYPES)[number]

/**
 * Channels worth pulling for the detail backfill. `latlng` and `temp`
 * are intentionally skipped — `latlng` is large and we have no map UX,
 * `temp` is rarely populated. Easy to add later if needed.
 */
export const DEFAULT_STREAM_KEYS: readonly StravaStreamType[] = [
  'time',
  'distance',
  'altitude',
  'velocity_smooth',
  'heartrate',
  'cadence',
  'grade_smooth',
]

export type StravaStreamData = {
  /** number[] for scalar channels, [lat, lng][] for `latlng`. */
  data: number[] | [number, number][]
  series_type: 'time' | 'distance'
  original_size: number
  resolution: 'low' | 'medium' | 'high'
}

/**
 * Strava response shape when `key_by_type=true` — one property per
 * requested channel. Channels Strava doesn't have for the activity are
 * simply absent from the object.
 */
export type StravaStreamSet = Partial<Record<StravaStreamType, StravaStreamData>>

/**
 * Thrown when Strava returns 429. Surfaced as a typed error so the
 * detail-fetch worker can pause until the next rate-limit window
 * instead of treating it as a generic failure.
 *
 * Strava sets `Retry-After` on 429 (seconds). We parse it best-effort;
 * null when the header is missing or unparseable.
 */
export class StravaRateLimitedError extends Error {
  constructor(public retryAfterSeconds: number | null) {
    super(
      `Strava rate limit hit${
        retryAfterSeconds !== null ? ` (retry after ${retryAfterSeconds}s)` : ''
      }`,
    )
    this.name = 'StravaRateLimitedError'
  }
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null
  const n = Number(headerValue)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── OAuth helpers ──────────────────────────────────────────────────

/** Exchange an authorization code for access + refresh tokens */
export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Strava token exchange failed (${response.status}): ${text}`,
    )
  }

  return response.json()
}

/** Refresh an expired access token */
export async function refreshAccessToken(refreshToken: string) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    throw new Error(`Strava token refresh failed: ${response.status}`)
  }

  return response.json()
}

// ── Activity fetching ──────────────────────────────────────────────

/** Fetch athlete activities from Strava API */
export async function fetchAthleteActivities(
  accessToken: string,
  params?: {
    page?: number
    per_page?: number
    after?: number
    before?: number
  },
): Promise<StravaActivity[]> {
  const url = new URL(`${STRAVA_API}/athlete/activities`)
  url.searchParams.set('per_page', String(params?.per_page ?? 200))
  if (params?.page) url.searchParams.set('page', String(params.page))
  if (params?.after) url.searchParams.set('after', String(params.after))
  if (params?.before) url.searchParams.set('before', String(params.before))

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 429) {
    throw new StravaRateLimitedError(
      parseRetryAfter(response.headers.get('retry-after')),
    )
  }
  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`)
  }

  return response.json()
}

/**
 * Fetch a single activity's detail payload. Crucially, this is the only
 * endpoint that returns `best_efforts` (per-distance splits with PR ranks)
 * — the list endpoint omits them.
 *
 * `include_all_efforts=true` ensures shorter activities still get any
 * applicable splits (Strava sometimes elides them for activities under 1k).
 *
 * Costs 1 Strava call against the standard 100/15min and 1000/day budget.
 */
export async function fetchActivityDetail(
  accessToken: string,
  activityId: number,
): Promise<StravaActivityDetail> {
  const url = new URL(`${STRAVA_API}/activities/${activityId}`)
  url.searchParams.set('include_all_efforts', 'true')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 429) {
    throw new StravaRateLimitedError(
      parseRetryAfter(response.headers.get('retry-after')),
    )
  }
  if (!response.ok) {
    throw new Error(
      `Strava activity detail fetch failed (${response.status}) for activity ${activityId}`,
    )
  }

  return response.json()
}

/**
 * Fetch per-second sensor streams for a single activity. `key_by_type=true`
 * returns an object keyed by channel name (vs an array), which is much
 * easier to consume.
 *
 * Costs 1 Strava call regardless of how many channels are requested.
 */
export async function fetchActivityStreams(
  accessToken: string,
  activityId: number,
  keys: readonly StravaStreamType[] = DEFAULT_STREAM_KEYS,
): Promise<StravaStreamSet> {
  const url = new URL(`${STRAVA_API}/activities/${activityId}/streams`)
  url.searchParams.set('keys', keys.join(','))
  url.searchParams.set('key_by_type', 'true')

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (response.status === 429) {
    throw new StravaRateLimitedError(
      parseRetryAfter(response.headers.get('retry-after')),
    )
  }
  // 404 is expected for activities with no recorded streams (manual entries,
  // very short walks). Return empty set — callers shouldn't treat this as
  // an error worth aborting the worker over.
  if (response.status === 404) {
    return {}
  }
  if (!response.ok) {
    throw new Error(
      `Strava streams fetch failed (${response.status}) for activity ${activityId}`,
    )
  }

  return response.json()
}

// ── Formatting helpers (shared) ────────────────────────────────────

/** Convert m/s speed → pace in seconds per km */
export function speedToPaceSeconds(speedMs: number): number {
  if (speedMs <= 0) return 0
  return 1000 / speedMs
}

/** Format pace seconds → "m:ss" */
export function formatPace(paceSeconds: number): string {
  if (paceSeconds <= 0) return '—'
  const min = Math.floor(paceSeconds / 60)
  const sec = Math.round(paceSeconds % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

/** Format meters → "xx.xx" km */
export function formatDistanceKm(meters: number): string {
  return (meters / 1000).toFixed(2)
}

/** Format total seconds → "h:mm:ss" or "mm:ss" */
export function formatDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds)
  const h = Math.floor(rounded / 3600)
  const m = Math.floor((rounded % 3600) / 60)
  const s = rounded % 60
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

