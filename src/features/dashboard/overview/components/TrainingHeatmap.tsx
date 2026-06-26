/**
 * GitHub-style training calendar — one cell per day for the last ~year,
 * shaded by that day's total run distance. Computed entirely client-side from
 * the unscoped run list; always a fixed 53-week window (ignores the range
 * toggle), so it reads as a year-at-a-glance of training consistency.
 */

import { useMemo } from 'react'
import Card from '@/features/dashboard/ui/Card'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import { getMonday } from '@/lib/dates'
import {
  distanceUnit,
  toDisplayDistance,
  type Activity,
  type Unit,
} from '@/lib/activities'

const WEEKS = 53
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function cellColor(level: number): string {
  if (level <= 0) return 'color-mix(in srgb, var(--ink) 7%, transparent)'
  const pct = [0, 28, 48, 72, 100][level]
  return `color-mix(in srgb, var(--accent) ${pct}%, transparent)`
}

type Cell = {
  key: string
  date: Date
  dist: number
  count: number
  level: number
  future: boolean
}

export default function TrainingHeatmap({
  runs,
  unit,
}: {
  runs: Activity[]
  unit: Unit
}) {
  const distLabel = distanceUnit(unit)

  const { weeks, total } = useMemo(() => {
    const perDay = new Map<string, { dist: number; count: number }>()
    for (const r of runs) {
      const k = dayKey(new Date(r.date))
      const cur = perDay.get(k) ?? { dist: 0, count: 0 }
      cur.dist += r.distanceMeters
      cur.count += 1
      perDay.set(k, cur)
    }

    // Quartile thresholds over non-zero days → four intensity levels.
    const vals = [...perDay.values()].map((v) => v.dist).filter((v) => v > 0).sort((a, b) => a - b)
    const q = (p: number) => (vals.length ? vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] : 0)
    const t = [q(0.25), q(0.5), q(0.75)]
    const levelOf = (dist: number) => {
      if (dist <= 0) return 0
      if (dist <= t[0]) return 1
      if (dist <= t[1]) return 2
      if (dist <= t[2]) return 3
      return 4
    }

    const todayKey = dayKey(new Date())
    const start = getMonday(new Date())
    start.setDate(start.getDate() - (WEEKS - 1) * 7)

    const weeks: Cell[][] = []
    let total = 0
    for (let w = 0; w < WEEKS; w++) {
      const col: Cell[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setDate(date.getDate() + w * 7 + d)
        const key = dayKey(date)
        const e = perDay.get(key)
        const dist = e?.dist ?? 0
        total += dist
        col.push({ key, date, dist, count: e?.count ?? 0, level: levelOf(dist), future: key > todayKey })
      }
      weeks.push(col)
    }
    return { weeks, total }
  }, [runs])

  const monthLabels = weeks.map((col, w) => {
    const m = col[0].date.getMonth()
    return w === 0 || m !== weeks[w - 1][0].date.getMonth() ? MONTHS[m] : ''
  })

  const title = (c: Cell) => {
    const d = c.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    if (c.future) return d
    if (c.count === 0) return `${d} · rest`
    return `${d} · ${toDisplayDistance(c.dist, unit)} ${distLabel} · ${c.count} ${c.count === 1 ? 'run' : 'runs'}`
  }

  return (
    <Card className="p-4">
      <SectionHeader
        title="Training"
        subtitle={`${toDisplayDistance(total, unit)} ${distLabel} over the last year`}
      />

      <div className="mt-3 flex gap-2">
        {/* Weekday labels — stretch to the grid height, 7 even slots. */}
        <div className="flex shrink-0 flex-col gap-[3px] pt-4 text-[9px] text-(--ink-4)">
          {WEEKDAYS.map((d, i) => (
            <div
              key={d}
              className="flex flex-1 items-center justify-end pr-1 leading-none"
            >
              {i === 0 || i === 2 || i === 4 ? d : ''}
            </div>
          ))}
        </div>

        {/* Months + grid — fills the remaining width; tiles are responsive
            squares (flex columns + aspect-square) so they wrap the card with
            no trailing grey, GitHub-style. */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex h-3 gap-[3px] text-[9px] text-(--ink-4)">
            {monthLabels.map((m, w) => (
              <div key={w} className="relative flex-1">
                {m && (
                  <span className="absolute left-0 top-0 whitespace-nowrap">{m}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            {weeks.map((col, w) => (
              <div key={w} className="flex flex-1 flex-col gap-[3px]">
                {col.map((c) => (
                  <div
                    key={c.key}
                    title={title(c)}
                    className="aspect-square w-full rounded-[2px]"
                    style={{ backgroundColor: c.future ? 'transparent' : cellColor(c.level) }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-(--ink-4)">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            className="inline-block h-[13px] w-[13px] rounded-[2px]"
            style={{ backgroundColor: cellColor(l) }}
          />
        ))}
        More
      </div>
    </Card>
  )
}
