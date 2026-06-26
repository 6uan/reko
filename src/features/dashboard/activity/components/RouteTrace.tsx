/**
 * Zero-dependency SVG route trace (option C). Projects the [lng,lat] route into
 * a fixed viewBox — longitude scaled by cos(latitude) so the shape isn't
 * horizontally stretched — and draws it as a single path. No tiles, no library.
 */

export default function RouteTrace({ route }: { route: [number, number][] }) {
  if (route.length < 2) return null

  const meanLat =
    ((route[0][1] + route[route.length - 1][1]) / 2) * (Math.PI / 180)
  const k = Math.cos(meanLat) || 1

  const xs = route.map((p) => p[0] * k)
  const ys = route.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const W = 600
  const H = 320
  const pad = 24
  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const s = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  const ox = (W - spanX * s) / 2
  const oy = (H - spanY * s) / 2

  const d = route
    .map((p, i) => {
      const x = ox + (p[0] * k - minX) * s
      const y = H - (oy + (p[1] - minY) * s) // flip: latitude grows upward
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <div className="rounded-(--radius-m) border border-(--line) bg-(--card-2) p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
