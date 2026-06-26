/**
 * Apple-style activity ring for HR-zone time distribution. Each of the five
 * zones is an arc proportional to time spent, drawn in its zone colour with a
 * small gap between segments. Optional center content (e.g. avg HR).
 */

import { HR_ZONES } from '@/lib/heartRate'

type Props = {
  /** Seconds spent in each of the 5 zones (index-aligned with HR_ZONES). */
  zoneSeconds: number[]
  center?: React.ReactNode
  size?: number
}

const R = 42
const SW = 11
const C = 2 * Math.PI * R

export default function HrZoneRing({ zoneSeconds, center, size = 100 }: Props) {
  const total = zoneSeconds.reduce((a, b) => a + b, 0)
  const gap = total > 0 ? 4 : 0

  let start = 0
  const segs = zoneSeconds.map((s, i) => {
    const len = total > 0 ? (s / total) * C : 0
    const seg = { color: HR_ZONES[i].color, name: HR_ZONES[i].name, len, start }
    start += len
    return seg
  })

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx={50}
          cy={50}
          r={R}
          fill="none"
          stroke="color-mix(in srgb, var(--ink) 8%, transparent)"
          strokeWidth={SW}
        />
        {segs.map((seg, i) =>
          seg.len > 0 ? (
            <circle
              key={i}
              cx={50}
              cy={50}
              r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={SW}
              strokeLinecap="round"
              strokeDasharray={`${Math.max(seg.len - gap, 0.001)} ${C}`}
              transform={`rotate(${(seg.start / C) * 360} 50 50)`}
            >
              <title>{seg.name}</title>
            </circle>
          ) : null,
        )}
      </svg>
      {center && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          {center}
        </div>
      )}
    </div>
  )
}
