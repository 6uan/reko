/**
 * Miami route corridors the demo personas run on.
 *
 * Each template is a one-way waypoint corridor ([lat, lng]); the
 * generator resamples along it at the run's pace, turns around when the
 * target distance calls for it (all corridors are out-and-back), and
 * adds per-run GPS jitter so no two runs trace identical pixels.
 *
 * Waypoints are hand-placed along real Miami running corridors — shaped
 * right at city zoom, not survey-grade. Elevation is flat coastal Miami
 * (~2–6 m) except bridge bumps, expressed as gaussian humps positioned
 * at a fraction of the one-way corridor.
 */

export type ElevationBump = {
  /** Position along the one-way corridor, 0..1. */
  at: number
  /** Peak height in meters above the base elevation. */
  height: number
  /** Approximate half-width of the hump, as a corridor fraction. */
  width: number
}

export type RouteTemplate = {
  key: string
  /** Shows up in generated activity names. */
  name: string
  kind: 'road' | 'track'
  /** One-way corridor, [lat, lng]. For 'track', one 400 m lap. */
  waypoints: Array<[number, number]>
  elevationBumps: ElevationBump[]
}

/** Brickell Baywalk — downtown waterfront, the everyday short run. */
const brickellBaywalk: RouteTemplate = {
  key: 'brickell-baywalk',
  name: 'Brickell Baywalk',
  kind: 'road',
  waypoints: [
    [25.7689, -80.1867],
    [25.766, -80.1875],
    [25.7625, -80.1888],
    [25.759, -80.19],
    [25.756, -80.1912],
    [25.753, -80.1922],
    [25.75, -80.1928],
    [25.747, -80.1932],
    [25.744, -80.1928],
    [25.7415, -80.1918],
  ],
  elevationBumps: [],
}

/** Rickenbacker Causeway to Key Biscayne — the long run, and Miami's only "hill". */
const rickenbacker: RouteTemplate = {
  key: 'rickenbacker',
  name: 'Rickenbacker Causeway',
  kind: 'road',
  waypoints: [
    [25.7452, -80.1998],
    [25.7456, -80.193],
    [25.7458, -80.1855], // William Powell Bridge crest
    [25.745, -80.178],
    [25.7445, -80.17],
    [25.742, -80.162],
    [25.7385, -80.1585],
    [25.735, -80.156], // Bear Cut Bridge
    [25.728, -80.1535],
    [25.718, -80.152],
    [25.712, -80.1528],
    [25.708, -80.1545],
  ],
  elevationBumps: [
    { at: 0.13, height: 21, width: 0.06 }, // William Powell Bridge
    { at: 0.62, height: 7, width: 0.04 }, // Bear Cut Bridge
  ],
}

/** South Beach boardwalk — beachfront, tourist-dodging tempo terrain. */
const southBeach: RouteTemplate = {
  key: 'south-beach',
  name: 'South Beach Boardwalk',
  kind: 'road',
  waypoints: [
    [25.7752, -80.133],
    [25.78, -80.1298],
    [25.785, -80.1285],
    [25.7907, -80.128],
    [25.796, -80.1278],
    [25.802, -80.125],
    [25.808, -80.1228],
    [25.8135, -80.1215],
  ],
  elevationBumps: [],
}

/** Kennedy Park down Main Hwy onto Old Cutler — shaded long-run corridor. */
const oldCutler: RouteTemplate = {
  key: 'old-cutler',
  name: 'Old Cutler Road',
  kind: 'road',
  waypoints: [
    [25.7373, -80.2344],
    [25.733, -80.237],
    [25.729, -80.242],
    [25.727, -80.244],
    [25.721, -80.252],
    [25.715, -80.257],
    [25.713, -80.256],
    [25.706, -80.264],
    [25.7, -80.268],
    [25.69, -80.275],
  ],
  elevationBumps: [],
}

/**
 * Tropical Park track — one 400 m lap as a parametric oval; the
 * generator repeats laps until the workout distance is covered.
 * a/b radii in meters chosen so the lap length lands at ~400 m.
 */
function tropicalParkTrack(): RouteTemplate {
  const center: [number, number] = [25.7327, -80.3353]
  const A = 78 // semi-major axis, meters (east-west)
  const B = 48 // semi-minor axis, meters
  const M_PER_DEG_LAT = 111_320
  const mPerDegLng = 111_320 * Math.cos((center[0] * Math.PI) / 180)

  const waypoints: Array<[number, number]> = []
  const STEPS = 32
  for (let i = 0; i < STEPS; i++) {
    const theta = (i / STEPS) * 2 * Math.PI
    const dxMeters = A * Math.cos(theta)
    const dyMeters = B * Math.sin(theta)
    waypoints.push([
      center[0] + dyMeters / M_PER_DEG_LAT,
      center[1] + dxMeters / mPerDegLng,
    ])
  }
  return {
    key: 'tropical-park-track',
    name: 'Tropical Park Track',
    kind: 'track',
    waypoints,
    elevationBumps: [],
  }
}

export const ROUTES: Record<string, RouteTemplate> = {
  brickellBaywalk,
  rickenbacker,
  southBeach,
  oldCutler,
  tropicalParkTrack: tropicalParkTrack(),
}

const M_PER_DEG_LAT = 111_320

/** Haversine-ish planar distance in meters — fine at run scale. */
export function segmentMeters(a: [number, number], b: [number, number]): number {
  const mPerDegLng = M_PER_DEG_LAT * Math.cos((a[0] * Math.PI) / 180)
  const dy = (b[0] - a[0]) * M_PER_DEG_LAT
  const dx = (b[1] - a[1]) * mPerDegLng
  return Math.sqrt(dx * dx + dy * dy)
}

/** One-way corridor length in meters. */
export function corridorMeters(route: RouteTemplate): number {
  let total = 0
  for (let i = 1; i < route.waypoints.length; i++) {
    total += segmentMeters(route.waypoints[i - 1], route.waypoints[i])
  }
  return total
}
