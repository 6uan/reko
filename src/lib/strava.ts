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

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`)
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
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Get Monday 00:00 of the week containing `date` */
export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setHours(0, 0, 0, 0)
  d.setDate(diff)
  return d
}
