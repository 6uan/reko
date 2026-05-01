/**
 * Personal Records tab.
 *
 * Interactive distance picker → podium (top 3) → full effort list.
 */

import { useMemo, useState } from 'react'
import { IoChevronForward } from 'react-icons/io5'
import { FaTrophy } from 'react-icons/fa'
import { formatDuration } from '@/lib/strava'
import { DISTANCE_DEFS, type RecordsData, type DistanceRecord, type DistanceKey } from '../distances'
import { paceUnit, type Activity, type Unit, type BestEffortTimes } from '@/lib/activities'
import { parseLocalDate, paceForDist, formatPace } from './helpers'
import ProgressionChart from './ProgressionChart'
import Card from '@/features/dashboard/ui/Card'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import Th from '@/features/dashboard/ui/Th'
import ActivityLink from '@/features/dashboard/ui/ActivityLink'

type Props = {
  data: RecordsData
  runs: Activity[]
  unit: Unit
}

/** Map from DISTANCE_DEFS key → BestEffortTimes key. */
const EFFORT_KEY_MAP: Record<string, keyof BestEffortTimes> = {
  '1k': '1k',
  '1mi': '1 mile',
  '5k': '5k',
  '10k': '10k',
  half: 'Half-Marathon',
  mar: 'Marathon',
}

type DistanceEffort = {
  time: number
  date: string
  activityName: string
  activityId: number
}

const PODIUM_STYLES = [
  { color: 'var(--gold)', label: '1st' },
  { color: 'var(--ink-3)', label: '2nd' },
  { color: '#a0724a', label: '3rd' },
] as const

// ── Helpers ──────────────────────────────────────────────────────

function timeAgo(dateStr: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(dateStr).getTime()) / 86400000)
  if (days < 1) return 'today'
  if (days < 2) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  const y = Math.floor(days / 365)
  return `${y} year${y > 1 ? 's' : ''} ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── Main component ───────────────────────────────────────────────

export default function Records({ data, runs, unit }: Props) {
  const now = useMemo(() => new Date(), [])
  const unitLabel = paceUnit(unit)

  // Hydrate distances
  const distancesByKey = useMemo(() => {
    const m = new Map<string, DistanceRecord>()
    for (const d of data.distances) m.set(d.key, d)
    return m
  }, [data.distances])

  const orderedDistances = useMemo(
    () =>
      DISTANCE_DEFS.map(
        (def) =>
          distancesByKey.get(def.key) ?? {
            key: def.key,
            label: def.label,
            meters: def.meters,
            best: null,
            runnerUp: null,
            thirdBest: null,
            trend: [],
          },
      ),
    [distancesByKey],
  )

  // Build full effort list per distance
  const effortsByDistance = useMemo(() => {
    const map = new Map<string, DistanceEffort[]>()
    for (const def of DISTANCE_DEFS) {
      const effortKey = EFFORT_KEY_MAP[def.key]
      if (!effortKey) continue
      const efforts: DistanceEffort[] = []
      for (const run of runs) {
        const time = run.bestEfforts[effortKey]
        if (time != null) {
          efforts.push({ time, date: run.date, activityName: run.name, activityId: run.id })
        }
      }
      efforts.sort((a, b) => a.time - b.time)
      map.set(def.key, efforts)
    }
    return map
  }, [runs])

  // Default selected = most recent PR distance
  const defaultKey = useMemo(() => {
    const withBest = orderedDistances.filter((d) => d.best)
    if (withBest.length === 0) return DISTANCE_DEFS[0].key
    return withBest.reduce((latest, d) =>
      parseLocalDate(d.best!.startDateLocal).getTime() >
      parseLocalDate(latest.best!.startDateLocal).getTime()
        ? d
        : latest,
    ).key
  }, [orderedDistances])

  const [selectedKey, setSelectedKey] = useState<DistanceKey>(defaultKey)

  const selected = orderedDistances.find((d) => d.key === selectedKey) ?? orderedDistances[0]
  const selectedEfforts = effortsByDistance.get(selectedKey) ?? []
  const totalPrs = orderedDistances.filter((d) => d.best).length

  if (totalPrs === 0) return <EmptyTab />

  // Podium entries (top 3)
  const podium = [selected.best, selected.runnerUp, selected.thirdBest].filter(
    (e): e is NonNullable<typeof e> => e != null,
  )

  return (
    <div className="flex flex-col gap-4">
      {/* Podium for selected distance */}
      {podium.length > 0 ? (
        <Card className="p-5">
          <div className="mb-5">
            <SectionHeader
              title={selected.label}
              subtitle={`${selectedEfforts.length} effort${selectedEfforts.length !== 1 ? 's' : ''}`}
            />
          </div>
          <div className={`grid gap-4 ${
            podium.length === 1
              ? 'grid-cols-1 max-w-xs'
              : podium.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-3'
          }`}>
            {podium.map((effort, i) => {
              const pace = paceForDist(effort.elapsedTime, selected.meters, unit)
              const style = PODIUM_STYLES[i]
              return (
                <div key={i} className="flex flex-col items-center text-center gap-2 py-4">
                  <FaTrophy size={i === 0 ? 28 : 20} style={{ color: style.color }} />
                  <div className="text-stat text-(--ink) leading-none mt-1">
                    {formatDuration(effort.elapsedTime)}
                  </div>
                  <div className="font-mono text-sm tabular-nums text-(--ink-3)">
                    {formatPace(pace)}{unitLabel}
                  </div>
                  <div className="text-sm text-(--ink-3) truncate max-w-full mt-1">
                    {effort.activityName}
                  </div>
                  <div className="text-meta">
                    {formatDate(effort.startDateLocal)}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center">
          <div className="font-mono text-sm text-(--ink-4)">
            No efforts at {selected.label} yet
          </div>
        </Card>
      )}

      {/* Distance picker grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {orderedDistances.map((rec) => {
          const isActive = rec.key === selectedKey
          const hasBest = rec.best != null
          return (
            <button
              key={rec.key}
              onClick={() => setSelectedKey(rec.key)}
              className={`text-left px-4 py-3.5 rounded-(--radius-m) border cursor-pointer transition-colors ${
                isActive
                  ? 'bg-(--card) border-(--accent) shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                  : 'bg-(--card) border-(--line) hover:bg-(--card-2)'
              }`}
            >
              <div className="text-eyebrow">{rec.label}</div>
              <div className="font-mono text-lg font-medium tabular-nums mt-1 tracking-tight">
                {hasBest ? formatDuration(rec.best!.elapsedTime) : (
                  <span className="text-(--ink-4)">—</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Progression chart */}
      <Disclosure
        title="Progression over time"
        meta={`${totalPrs} distance${totalPrs === 1 ? '' : 's'} tracked`}
      >
        <ProgressionChart distances={orderedDistances} />
      </Disclosure>

      {/* Full effort list */}
      {selectedEfforts.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-(--line)">
            <SectionHeader
              title="All efforts"
              subtitle={`${selected.label} · sorted by time`}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr>
                  {['#', 'Time', 'Pace', 'Activity', 'Date'].map((h) => (
                    <Th key={h}>{h}</Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedEfforts.map((effort, i) => {
                  const effortPace = paceForDist(effort.time, selected.meters, unit)
                  const isBest = i === 0
                  return (
                    <tr key={`${effort.activityId}-${i}`}>
                      <td className="px-4 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3) w-14 whitespace-nowrap">
                        {i + 1}
                      </td>
                      <td className="px-4 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums font-medium">
                        <span className={isBest ? 'text-(--accent)' : 'text-(--ink)'}>
                          {formatDuration(effort.time)}
                        </span>
                      </td>
                      <td className="px-4 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3)">
                        {formatPace(effortPace)}{unitLabel}
                      </td>
                      <td className="px-4 py-3 border-b border-(--line-2) text-sm text-(--ink-2)">
                        <ActivityLink
                          activityId={effort.activityId}
                          className="text-(--ink-2) no-underline"
                        >
                          {effort.activityName}
                        </ActivityLink>
                      </td>
                      <td className="px-4 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
                        {timeAgo(effort.date, now)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────

function Disclosure({
  title,
  meta,
  children,
}: {
  title: string
  meta: string
  children: React.ReactNode
}) {
  return (
    <details className="group bg-(--card) border border-(--line) rounded-2xl overflow-hidden">
      <summary className="flex justify-between items-center px-5 py-4 cursor-pointer list-none hover:bg-(--card-2) transition-colors [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-medium text-(--ink) tracking-tight">
          {title}
        </span>
        <span className="flex items-center gap-3 text-meta">
          {meta}
          <IoChevronForward
            size={12}
            className="text-(--ink-3) transition-transform duration-150 group-open:rotate-90"
          />
        </span>
      </summary>
      <div className="border-t border-(--line)">{children}</div>
    </details>
  )
}

function EmptyTab() {
  return (
    <div className="py-20 px-10 text-center border border-dashed border-(--line) rounded-2xl bg-(--card-2)">
      <div className="w-15 h-15 mx-auto mb-5 rounded-full bg-(--accent-soft) grid place-items-center text-(--accent)">
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 3h14l-1.5 8h-11z" />
          <path d="M4 14h16" />
          <path d="M9 21h6" />
          <path d="M12 14v7" />
        </svg>
      </div>
      <h2 className="text-xl font-medium m-0 mb-2 text-(--ink) tracking-tight">
        Your records will live here.
      </h2>
      <p className="text-sm text-(--ink-3) mx-auto max-w-[42ch] leading-relaxed">
        Run any of the standard distances — 1K, 1 mile, 5K, 10K, half, or
        marathon — and Reko will surface your fastest effort across every
        activity automatically.
      </p>
    </div>
  )
}
