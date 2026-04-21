import { useMemo } from 'react'
import {
  speedToPaceSeconds,
  formatPace,
  formatDistanceKm,
  formatDuration,
} from '../../lib/strava'

// ── Types ─────────────────────────────────────────────────────────

export type DashboardRun = {
  id: number
  name: string
  date: string
  distanceMeters: number
  movingTime: number
  avgSpeed: number
  avgHr: number | null
  maxHr: number | null
  cadence: number | null
  elevation: number
  prCount: number
}

type Props = {
  runs: DashboardRun[]
  unit: 'km' | 'mi'
}

// ── Helpers ───────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatDistForUnit(meters: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') return (meters / 1609.344).toFixed(2)
  return formatDistanceKm(meters)
}

function paceForUnit(speedMs: number, unit: 'km' | 'mi'): number {
  const paceSec = speedToPaceSeconds(speedMs)
  return unit === 'mi' ? paceSec * 1.60934 : paceSec
}

/** Generate a gentle declining sparkline path */
function sparklinePath(seed: number): string {
  const W = 80
  const pts = 8
  const vals: number[] = []
  let v = 20 + (seed % 4)
  for (let i = 0; i < pts; i++) {
    v = v - 0.5 - ((seed * (i + 1)) % 3) * 0.6
    vals.push(Math.max(2, Math.min(22, v)))
  }
  return vals
    .map((y, i) => {
      const x = (i / (pts - 1)) * W
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// ── Placeholder distances ───────────────────────────────────────

const PLACEHOLDER_DISTANCES = [
  { label: '5K', meters: 5000 },
  { label: '10K', meters: 10000 },
  { label: 'Half', meters: 21097.5 },
]

// ── Component ─────────────────────────────────────────────────────

export default function Records({ runs, unit }: Props) {
  const prRuns = useMemo(
    () =>
      runs
        .filter((r) => r.prCount > 0)
        .sort(
          (a, b) =>
            new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
    [runs],
  )

  const totalPrs = useMemo(
    () => prRuns.reduce((sum, r) => sum + r.prCount, 0),
    [prRuns],
  )

  // Build the cards: up to 3, fill with placeholders if needed
  const prCards = useMemo(() => {
    type Card = {
      key: string
      label: string
      time: string
      pace: string
      activity: string
      date: string
      real: boolean
      seed: number
    }

    const cards: Card[] = prRuns.slice(0, 3).map((r) => {
      const dist = formatDistForUnit(r.distanceMeters, unit)
      const pace = paceForUnit(r.avgSpeed, unit)
      return {
        key: `pr-${r.id}`,
        label: `${dist} ${unit}`,
        time: formatDuration(r.movingTime),
        pace: `${formatPace(pace)} /${unit}`,
        activity: r.name,
        date: formatDate(r.date),
        real: true,
        seed: r.id,
      }
    })

    // Fill remaining slots with placeholder cards
    let placeholderIdx = 0
    while (cards.length < 3 && placeholderIdx < PLACEHOLDER_DISTANCES.length) {
      const ph = PLACEHOLDER_DISTANCES[placeholderIdx]
      // Skip if we already have a card at roughly this distance
      const alreadyCovered = cards.some(
        (c) => c.real && c.label.includes(ph.label),
      )
      if (!alreadyCovered) {
        cards.push({
          key: `ph-${ph.label}`,
          label: ph.label,
          time: '--:--',
          pace: '--:--',
          activity: 'No data yet',
          date: '---',
          real: false,
          seed: placeholderIdx * 7 + 3,
        })
      }
      placeholderIdx++
      if (cards.length >= 3) break
    }

    return cards.slice(0, 3)
  }, [prRuns, unit])

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-[17px] font-semibold text-[var(--ink)] tracking-tight leading-tight">
          Personal records
        </h2>
        <p className="font-mono text-[11px] text-[var(--ink-4)] mt-0.5">
          {totalPrs} PR{totalPrs !== 1 ? 's' : ''} across{' '}
          {prRuns.length} activit{prRuns.length !== 1 ? 'ies' : 'y'}
        </p>
      </div>

      {/* PR cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {prCards.map((card) => (
          <div
            key={card.key}
            className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-[18px] relative overflow-hidden"
          >
            {/* Sparkline decoration */}
            <svg
              viewBox="0 0 80 24"
              className="absolute bottom-3.5 right-3.5 opacity-40"
              width={80}
              height={24}
              fill="none"
            >
              <path
                d={sparklinePath(card.seed)}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--ink-3)]">
              {card.label}
            </div>
            <div className="font-mono text-[36px] font-medium tracking-tight tabular-nums mt-1.5 text-[var(--ink)]">
              {card.time}
            </div>
            <div className="font-mono text-[12px] text-[var(--ink-3)] mt-0.5">
              {card.pace}
              {card.real && (
                <span className="ml-1.5">&middot; {card.activity}</span>
              )}
            </div>

            {/* Meta row */}
            <div className="flex justify-between font-mono text-[11px] text-[var(--ink-3)] mt-3.5 pt-3 border-t border-[var(--line-2)]">
              <span>{card.real ? card.activity : '---'}</span>
              <span>{card.date}</span>
            </div>
          </div>
        ))}
      </div>

      {/* PR history table */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Date
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Distance
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Time
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Pace
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Activity
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Details
                </th>
              </tr>
            </thead>
            <tbody>
              {prRuns.map((run) => {
                const pace = paceForUnit(run.avgSpeed, unit)
                const dist = formatDistForUnit(run.distanceMeters, unit)
                return (
                  <tr key={run.id}>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] text-[var(--ink-3)]">
                      {formatDate(run.date)}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {dist}
                      <span className="text-[var(--ink-3)] ml-0.5">
                        {unit}
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {formatDuration(run.movingTime)}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {formatPace(pace)}/{unit}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-medium text-[var(--ink)]">
                      {run.name}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink-3)]">
                      {run.prCount} PR{run.prCount !== 1 ? 's' : ''}
                      {run.avgHr != null && (
                        <span className="ml-1.5">
                          &middot; {Math.round(run.avgHr)} bpm
                        </span>
                      )}
                      {run.elevation > 0 && (
                        <span className="ml-1.5">
                          &middot; {Math.round(run.elevation)}m elev
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {prRuns.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-3 py-6 text-center text-[13px] text-[var(--ink-3)]"
                  >
                    No personal records yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
