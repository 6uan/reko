/**
 * GitHub-style training calendar — one cell per day, shaded by that day's
 * total run distance. The visible weeks are intentionally capped to either a
 * rolling 12-month window or one selected calendar year.
 */

import { useMemo, useState, type CSSProperties } from 'react'
import Card from '@/features/dashboard/ui/Card'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import type { RangeKey } from '@/features/dashboard/range'
import { getMonday } from '@/lib/dates'
import {
  distanceUnit,
  toDisplayDistance,
  type Activity,
  type Unit,
} from '@/lib/activities'

const MIN_CELL_SIZE = 10
const WEEKDAY_LABEL_WIDTH = 28
const TILE_GAP = 2
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const heatmapRowsStyle = {
  rowGap: TILE_GAP,
} satisfies CSSProperties

function startOfDay(d: Date): Date {
  const copy = new Date(d)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

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
  inRange: boolean
  future: boolean
}

type HeatmapWindow = {
  activeStart: Date
  activeEnd: Date
  gridStart: Date
  gridEnd: Date
  subtitleSuffix: string
}

function heatmapWindow(range: RangeKey, now: Date): HeatmapWindow {
  const today = startOfDay(now)

  if (range === 'all' || range === '12m') {
    const activeStart = new Date(today.getFullYear(), today.getMonth() - 11, 1)
    return {
      activeStart,
      activeEnd: today,
      gridStart: getMonday(activeStart),
      gridEnd: getMonday(today),
      subtitleSuffix: 'over the last 12 months',
    }
  }

  if (range === 'ytd') {
    const activeStart = new Date(today.getFullYear(), 0, 1)
    return {
      activeStart,
      activeEnd: today,
      gridStart: getMonday(activeStart),
      gridEnd: getMonday(today),
      subtitleSuffix: `in ${today.getFullYear()}`,
    }
  }

  const selectedYear = Number(range)
  if (Number.isInteger(selectedYear)) {
    const activeStart = new Date(selectedYear, 0, 1)
    const activeEnd = new Date(selectedYear, 11, 31)
    return {
      activeStart,
      activeEnd,
      gridStart: getMonday(activeStart),
      gridEnd: getMonday(activeEnd),
      subtitleSuffix: `in ${selectedYear}`,
    }
  }

  return heatmapWindow('12m', today)
}

export default function TrainingHeatmap({
  runs,
  unit,
  range,
}: {
  runs: Activity[]
  unit: Unit
  range: RangeKey
}) {
  const distLabel = distanceUnit(unit)

  const { weeks, total, subtitleSuffix } = useMemo(() => {
    const today = startOfDay(new Date())
    const rangeWindow = heatmapWindow(range, today)
    const perDay = new Map<string, { dist: number; count: number }>()
    for (const r of runs) {
      const date = startOfDay(new Date(r.date))
      if (date < rangeWindow.activeStart || date > rangeWindow.activeEnd || date > today) continue
      const k = dayKey(date)
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

    const weeks: Cell[][] = []
    let total = 0
    for (
      let weekStart = new Date(rangeWindow.gridStart);
      weekStart <= rangeWindow.gridEnd;
      weekStart = addDays(weekStart, 7)
    ) {
      const col: Cell[] = []
      for (let d = 0; d < 7; d++) {
        const date = addDays(weekStart, d)
        const key = dayKey(date)
        const inRange = date >= rangeWindow.activeStart && date <= rangeWindow.activeEnd
        const future = date > today
        const e = inRange && !future ? perDay.get(key) : undefined
        const dist = e?.dist ?? 0
        total += dist
        col.push({
          key,
          date,
          dist,
          count: e?.count ?? 0,
          level: levelOf(dist),
          inRange,
          future,
        })
      }
      weeks.push(col)
    }
    return { weeks, total, subtitleSuffix: rangeWindow.subtitleSuffix }
  }, [runs, range])

  const monthLabels = weeks.map((col, w) => {
    const firstInRange = col.find((c) => c.inRange)
    if (!firstInRange) return ''
    const previousInRange = weeks[w - 1]?.find((c) => c.inRange)
    const month = firstInRange.date.getMonth()
    return w === 0 || month !== previousInRange?.date.getMonth() ? MONTHS[month] : ''
  })

  const weekCount = weeks.length
  const heatmapColumnsStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `${WEEKDAY_LABEL_WIDTH}px repeat(${weekCount}, minmax(${MIN_CELL_SIZE}px, 1fr))`,
      columnGap: TILE_GAP,
    }),
    [weekCount],
  )
  const heatmapMinWidth =
    WEEKDAY_LABEL_WIDTH + weekCount * MIN_CELL_SIZE + weekCount * TILE_GAP

  const tipFor = (c: Cell) => {
    const date = c.date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    if (!c.inRange || c.future) return { date, detail: '' }
    if (c.count === 0) return { date, detail: 'Rest day' }
    return {
      date,
      detail: `${toDisplayDistance(c.dist, unit)} ${distLabel} · ${c.count} ${c.count === 1 ? 'run' : 'runs'}`,
    }
  }

  // One shared tooltip, viewport-positioned so the heatmap's horizontal
  // scroll container can't clip it. Native `title` was too slow/plain.
  const [tip, setTip] = useState<{
    x: number
    y: number
    date: string
    detail: string
  } | null>(null)

  return (
    <Card className="h-full min-w-0 overflow-hidden p-4">
      <SectionHeader
        title="Training"
        subtitle={`${toDisplayDistance(total, unit)} ${distLabel} ${subtitleSuffix}`}
      />

      {/* The grid expands to the card width on roomy screens, then keeps a
          legible minimum and scrolls inside the card when space gets tight. */}
      <div
        aria-label="Training heatmap timeline"
        role="region"
        tabIndex={0}
        className="-mx-4 mt-3 overflow-x-auto px-4 pb-2 [scrollbar-width:thin] focus-visible:outline focus-visible:outline-1 focus-visible:outline-(--accent)"
      >
        <div className="w-full" style={{ minWidth: heatmapMinWidth }}>
          <div
            className="grid h-3 text-[9px] text-(--ink-4)"
            style={heatmapColumnsStyle}
          >
            <div aria-hidden="true" />
            {monthLabels.map((m, w) => (
              <div key={w} className="relative min-w-0">
                {m && (
                  <span
                    className={`absolute top-0 whitespace-nowrap ${
                      w > weekCount - 4 ? 'right-0' : 'left-0'
                    }`}
                  >
                    {m}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div
            className="mt-1 grid"
            style={heatmapColumnsStyle}
          >
            <div
              className="grid h-full grid-rows-7 text-[9px] text-(--ink-4)"
              style={heatmapRowsStyle}
            >
              {WEEKDAYS.map((d, i) => (
                <div key={d} className="flex items-center justify-end pr-1 leading-none">
                  {i === 0 || i === 2 || i === 4 ? d : ''}
                </div>
              ))}
            </div>

            {weeks.map((col, w) => (
              <div
                key={w}
                className="grid grid-rows-7"
                style={heatmapRowsStyle}
              >
                {col.map((c) => (
                  <div
                    key={c.key}
                    className="aspect-square w-full rounded-[2px]"
                    style={{ backgroundColor: !c.inRange || c.future ? 'transparent' : cellColor(c.level) }}
                    onMouseEnter={(e) => {
                      if (!c.inRange || c.future) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      setTip({
                        x: rect.left + rect.width / 2,
                        y: rect.top,
                        ...tipFor(c),
                      })
                    }}
                    onMouseLeave={() => setTip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {tip && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-(--radius-s) border border-(--line) bg-(--bg-elev) px-2.5 py-1.5 text-center shadow-(--shadow-l) whitespace-nowrap"
          style={{ left: tip.x, top: tip.y - 6 }}
        >
          <div className="text-[11px] font-medium text-(--ink) leading-tight">
            {tip.date}
          </div>
          {tip.detail && (
            <div className="font-mono text-[11px] tabular-nums text-(--ink-3) leading-tight mt-0.5">
              {tip.detail}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[10px] text-(--ink-4)">
        Less
        {[0, 1, 2, 3, 4].map((l) => (
          <span
            key={l}
            className="inline-block h-[14px] w-[14px] rounded-[2px]"
            style={{ backgroundColor: cellColor(l) }}
          />
        ))}
        More
      </div>
    </Card>
  )
}
