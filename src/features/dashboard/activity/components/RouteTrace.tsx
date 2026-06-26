/**
 * Zero-dependency SVG route trace (option C). Projects the [lng,lat] route into
 * a fixed viewBox — longitude scaled by cos(latitude) so the shape isn't
 * horizontally stretched — and draws it as a single path, plus a dot at the
 * hovered position. No tiles, no library.
 */

import { nearestIndex } from './routeUtils'

type Props = {
  points: [number, number][]
  distM: number[]
  hoverDist: number | null
}

const W = 400
const H = 400
const PAD = 28

export default function RouteTrace({ points, distM, hoverDist }: Props) {
  if (points.length < 2) return null

  const meanLat =
    ((points[0][1] + points[points.length - 1][1]) / 2) * (Math.PI / 180)
  const k = Math.cos(meanLat) || 1

  const xs = points.map((p) => p[0] * k)
  const ys = points.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)

  const spanX = Math.max(maxX - minX, 1e-9)
  const spanY = Math.max(maxY - minY, 1e-9)
  const s = Math.min((W - 2 * PAD) / spanX, (H - 2 * PAD) / spanY)
  const ox = (W - spanX * s) / 2
  const oy = (H - spanY * s) / 2

  const project = (p: [number, number]): [number, number] => [
    ox + (p[0] * k - minX) * s,
    H - (oy + (p[1] - minY) * s), // flip: latitude grows upward
  ]

  const d = points
    .map((p, i) => {
      const [x, y] = project(p)
      return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')

  const hover =
    hoverDist != null && distM.length > 0
      ? project(points[nearestIndex(distM, hoverDist)])
      : null

  return (
    <div className="aspect-square w-full overflow-hidden rounded-(--radius-m) border border-(--line) bg-(--card-2)">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
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
        {hover && (
          <circle
            cx={hover[0]}
            cy={hover[1]}
            r={6}
            fill="var(--accent)"
            stroke="#fff"
            strokeWidth={2}
          />
        )}
      </svg>
    </div>
  )
}
