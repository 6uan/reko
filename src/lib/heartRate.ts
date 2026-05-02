/**
 * Heart-rate zones and stream-derived sustained-pace computation.
 *
 * Strava doesn't ship per-zone sustained-pace metrics. We derive them
 * from the activity's heartrate / distance / time streams: for each zone,
 * find the fastest contiguous window where every heartrate sample stays
 * in zone.
 *
 * Each zone has a *canonical* sustained window picked to match physiology
 * (Z5 max efforts last seconds, Z1 recovery efforts last 20+ min). When
 * a zone has no data at its canonical window, we fall back through
 * shorter windows so the user still sees something meaningful.
 */

export const HR_ZONES = [
  { name: 'Z1 Recovery',  min: 0,   max: 124,      color: 'var(--hr-1)' },
  { name: 'Z2 Aerobic',   min: 124, max: 143,      color: 'var(--hr-2)' },
  { name: 'Z3 Tempo',     min: 143, max: 162,      color: 'var(--hr-3)' },
  { name: 'Z4 Threshold', min: 162, max: 181,      color: 'var(--hr-4)' },
  { name: 'Z5 VO₂max',    min: 181, max: Infinity, color: 'var(--hr-5)' },
] as const

export type HrZone = (typeof HR_ZONES)[number]
export type HrZoneName = HrZone['name']

/**
 * Canonical sustained-effort duration per zone (seconds). Each is the
 * longest physiologically meaningful window we'd ever show for that zone.
 */
export const ZONE_WINDOWS: Record<HrZoneName, number> = {
  'Z1 Recovery':  1200, // 20 min
  'Z2 Aerobic':   1200, // 20 min
  'Z3 Tempo':      600, // 10 min
  'Z4 Threshold':  300, // 5 min
  'Z5 VO₂max':      60, // 1 min
}

/**
 * All durations we compute and store, descending. The display logic
 * walks this list per zone (clipped to that zone's canonical max) and
 * picks the LONGEST window with data — so a Z4 user sees "5m best" if
 * they have it, otherwise "2m best", "1m best", or "30s best".
 */
export const SUSTAINED_WINDOWS = [1200, 600, 300, 120, 60, 30] as const

/** Windows applicable to a given zone, descending (longest first). */
export function fallbackWindowsFor(zone: HrZoneName): number[] {
  const target = ZONE_WINDOWS[zone]
  return SUSTAINED_WINDOWS.filter((w) => w <= target)
}

/** Short label: "20m", "5m", "1m", "30s". */
export function formatWindow(seconds: number): string {
  if (seconds >= 60) return `${seconds / 60}m`
  return `${seconds}s`
}

/** Map zone name → { windowSec → fastest sustained pace (seconds per km) }. */
export type HrZoneEfforts = Partial<Record<HrZoneName, Record<number, number>>>

export function rangeLabel(zone: HrZone): string {
  return zone.max === Infinity ? `${zone.min}+ bpm` : `${zone.min}–${zone.max} bpm`
}

export function zoneFor(hr: number): HrZone {
  return HR_ZONES.find((z) => hr >= z.min && hr < z.max) ?? HR_ZONES[4]
}

/**
 * For one zone + window, find the fastest contiguous window of at least
 * `windowSec` seconds where every HR sample is in [zoneMin, zoneMax).
 * Returns the window's average pace (sec/km), or null when no such
 * window exists.
 *
 * Two-phase: collect maximal in-zone segments, then sliding-window
 * inside each long-enough segment. O(n) overall.
 */
export function bestSustainedPaceInZone(
  distance: number[],
  time: number[],
  hr: number[],
  zoneMin: number,
  zoneMax: number,
  windowSec: number,
): number | null {
  const n = hr.length
  if (n < 2 || distance.length !== n || time.length !== n) return null

  // 1. Maximal in-zone segments (inclusive index ranges).
  const segments: Array<[number, number]> = []
  let segStart = -1
  for (let i = 0; i < n; i++) {
    const inZone = hr[i] >= zoneMin && hr[i] < zoneMax
    if (inZone && segStart === -1) segStart = i
    else if (!inZone && segStart !== -1) {
      segments.push([segStart, i - 1])
      segStart = -1
    }
  }
  if (segStart !== -1) segments.push([segStart, n - 1])

  // 2. Sliding window within each segment long enough to fit windowSec.
  let best = Infinity
  for (const [start, end] of segments) {
    if (time[end] - time[start] < windowSec) continue

    let left = start
    for (let right = start + 1; right <= end; right++) {
      while (left + 1 <= right && time[right] - time[left + 1] >= windowSec) {
        left++
      }
      if (time[right] - time[left] >= windowSec) {
        const dt = time[right] - time[left]
        const dd = distance[right] - distance[left]
        if (dd > 0) {
          const paceSecPerKm = (dt * 1000) / dd
          if (paceSecPerKm < best) best = paceSecPerKm
        }
      }
    }
  }

  return best === Infinity ? null : best
}

/**
 * For every zone, compute the best sustained pace at every applicable
 * window (canonical + fallbacks). Returns a nested {zone: {window: pace}}.
 */
export function computeHrZoneEfforts(
  distance: number[],
  time: number[],
  hr: number[],
): HrZoneEfforts {
  const result: HrZoneEfforts = {}
  for (const zone of HR_ZONES) {
    const windows = fallbackWindowsFor(zone.name)
    const byWindow: Record<number, number> = {}
    for (const w of windows) {
      const pace = bestSustainedPaceInZone(
        distance,
        time,
        hr,
        zone.min,
        zone.max,
        w,
      )
      if (pace !== null) byWindow[w] = pace
    }
    if (Object.keys(byWindow).length > 0) {
      result[zone.name] = byWindow
    }
  }
  return result
}
