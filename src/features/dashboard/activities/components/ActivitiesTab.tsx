import { useState, useMemo, useRef, useEffect } from 'react'
import { formatPace, formatDuration } from '@/lib/strava'
import {
  activityKind,
  toDisplayDistance,
  paceForUnit,
  distanceUnit,
  paceUnit,
  type BestEffortTimes,
  type Activity,
  type Unit,
} from '@/lib/activities'
import Card from '@/features/dashboard/ui/Card'
import ActivityLink from '@/features/dashboard/ui/ActivityLink'

type Props = {
  activities: Activity[]
  unit: Unit
}

// ── Filter definitions ─────────────────────────────────────────────

type SportFilter = 'all' | 'run' | 'walk'
type FilterKey = 'all' | 'has_pr' | '10km' | 'tempo' | 'easy'

const SPORT_OPTIONS: { key: SportFilter; label: string }[] = [
  { key: 'all', label: 'All Activities' },
  { key: 'run', label: 'Runs only' },
  { key: 'walk', label: 'Walks only' },
]

const INTENSITY_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'No filter' },
  { key: 'has_pr', label: 'Has PR' },
  { key: '10km', label: '10 km+' },
  { key: 'tempo', label: 'Tempo+ (HR ≥ 155)' },
  { key: 'easy', label: 'Easy (HR < 150)' },
]

function applySportFilter(list: Activity[], sport: SportFilter) {
  if (sport === 'all') return list
  return list.filter((a) => activityKind(a) === sport)
}

function applyFilter(list: Activity[], filter: FilterKey) {
  switch (filter) {
    case 'has_pr':
      return list.filter((r) => r.prCount > 0)
    case '10km':
      return list.filter((r) => r.distanceMeters >= 10_000)
    case 'tempo':
      return list.filter((r) => r.avgHr !== null && r.avgHr >= 155)
    case 'easy':
      return list.filter((r) => r.avgHr !== null && r.avgHr < 150)
    default:
      return list
  }
}

// ── Sort ───────────────────────────────────────────────────────────

type SortCol =
  | 'name' | 'date' | 'distance' | 'time' | 'pace'
  | 'avgHr' | 'maxHr' | 'cadence' | 'elevation'
  | '1k' | '1 mile' | '5k' | '10k' | 'Half-Marathon' | 'Marathon'

type SortDir = 'asc' | 'desc'

/**
 * Natural "first click" direction per column.
 * - Best effort times + pace: fastest (lowest) first → asc
 * - Name: alphabetical → asc
 * - Everything else (date, distance, HR, etc.): biggest first → desc
 */
const DEFAULT_DIR: Partial<Record<SortCol, SortDir>> = {
  name: 'asc',
  pace: 'asc',
  '1k': 'asc',
  '1 mile': 'asc',
  '5k': 'asc',
  '10k': 'asc',
  'Half-Marathon': 'asc',
  'Marathon': 'asc',
}

function effortVal(run: Activity, key: keyof BestEffortTimes): number {
  return run.bestEfforts[key] ?? Infinity
}

function sortRuns(runs: Activity[], col: SortCol, dir: SortDir, unit: Unit) {
  const sorted = [...runs]
  const m = dir === 'asc' ? 1 : -1
  sorted.sort((a, b) => {
    switch (col) {
      case 'name': return m * a.name.localeCompare(b.name)
      case 'date': return m * (new Date(a.date).getTime() - new Date(b.date).getTime())
      case 'distance': return m * (a.distanceMeters - b.distanceMeters)
      case 'time': return m * (a.movingTime - b.movingTime)
      case 'pace': return m * (paceForUnit(a.avgSpeed, unit) - paceForUnit(b.avgSpeed, unit))
      case 'avgHr': return m * ((a.avgHr ?? 0) - (b.avgHr ?? 0))
      case 'maxHr': return m * ((a.maxHr ?? 0) - (b.maxHr ?? 0))
      case 'cadence': return m * ((a.cadence ?? 0) - (b.cadence ?? 0))
      case 'elevation': return m * (a.elevation - b.elevation)
      case '1k': case '1 mile': case '5k': case '10k': case 'Half-Marathon': case 'Marathon':
        return m * (effortVal(a, col) - effortVal(b, col))
      default: return 0
    }
  })
  return sorted
}

// ── Column config ──────────────────────────────────────────────────

type ColDef = {
  key: SortCol
  label: string
  align: 'left' | 'right' | 'center'
  /** Whether the column is fixed (always visible, not toggleable). */
  fixed?: boolean
  /** Whether the column is on by default. */
  defaultOn?: boolean
}

const COLUMNS: ColDef[] = [
  { key: 'name', label: 'Activity', align: 'left', fixed: true },
  { key: 'date', label: 'Date', align: 'left', fixed: true },
  { key: 'distance', label: 'Distance', align: 'right', fixed: true },
  { key: 'time', label: 'Time', align: 'right', fixed: true },
  { key: 'pace', label: 'Pace', align: 'right', fixed: true },
  { key: 'avgHr', label: 'Avg HR', align: 'right', defaultOn: true },
  { key: 'maxHr', label: 'Max HR', align: 'right', defaultOn: false },
  { key: 'cadence', label: 'Cadence', align: 'right', defaultOn: true },
  { key: '1k', label: '1K', align: 'right', defaultOn: true },
  { key: '1 mile', label: 'Mile', align: 'right', defaultOn: true },
  { key: '5k', label: '5K', align: 'right', defaultOn: true },
  { key: '10k', label: '10K', align: 'right', defaultOn: false },
  { key: 'Half-Marathon', label: 'Half Marathon', align: 'right', defaultOn: false },
  { key: 'Marathon', label: 'Marathon', align: 'right', defaultOn: false },
  { key: 'elevation', label: 'Elevation', align: 'right', defaultOn: false },
]

/** Toggleable columns — everything not fixed. */
const TOGGLEABLE_COLS = COLUMNS.filter((c) => !c.fixed)

/** Default set of visible toggleable column keys. */
const DEFAULT_VISIBLE = new Set(
  TOGGLEABLE_COLS.filter((c) => c.defaultOn).map((c) => c.key),
)

// ── Component ──────────────────────────────────────────────────────

export default function Activities({ activities, unit }: Props) {
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [sortCol, setSortCol] = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [visibleColKeys, setVisibleColKeys] = useState<Set<SortCol>>(
    () => new Set(DEFAULT_VISIBLE),
  )
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Draft state for the dropdown — only committed on Apply.
  const [draftSport, setDraftSport] = useState<SportFilter>(sportFilter)
  const [draftIntensity, setDraftIntensity] = useState<FilterKey>(activeFilter)
  const [draftCols, setDraftCols] = useState<Set<SortCol>>(
    () => new Set(visibleColKeys),
  )

  // Sync drafts when dropdown opens.
  function openFilter() {
    setDraftSport(sportFilter)
    setDraftIntensity(activeFilter)
    setDraftCols(new Set(visibleColKeys))
    setFilterOpen(true)
  }

  function applyDraft() {
    setSportFilter(draftSport)
    setActiveFilter(draftIntensity)
    setVisibleColKeys(new Set(draftCols))
    setFilterOpen(false)
  }

  function clearAll() {
    setDraftSport('all')
    setDraftIntensity('all')
    setDraftCols(new Set(DEFAULT_VISIBLE))
  }

  function toggleDraftCol(key: SortCol) {
    setDraftCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Close filter dropdown on outside click.
  useEffect(() => {
    if (!filterOpen) return
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [filterOpen])

  const bySport = useMemo(
    () => applySportFilter(activities, sportFilter),
    [activities, sportFilter],
  )

  const filtered = useMemo(
    () => applyFilter(bySport, activeFilter),
    [bySport, activeFilter],
  )

  const sorted = useMemo(
    () => sortRuns(filtered, sortCol, sortDir, unit),
    [filtered, sortCol, sortDir, unit],
  )

  const visibleCols = useMemo(
    () => COLUMNS.filter((c) => c.fixed || visibleColKeys.has(c.key)),
    [visibleColKeys],
  )

  const hasActiveFilter = sportFilter !== 'all' || activeFilter !== 'all'
  const hasCustomCols = (() => {
    if (visibleColKeys.size !== DEFAULT_VISIBLE.size) return true
    for (const k of DEFAULT_VISIBLE) {
      if (!visibleColKeys.has(k)) return true
    }
    return false
  })()
  const hasChanges = hasActiveFilter || hasCustomCols

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortCol(col)
      setSortDir(DEFAULT_DIR[col] ?? 'desc')
    }
  }

  const unitLabel = distanceUnit(unit)
  const paceLabel = paceUnit(unit)

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar — count + actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-(--ink-3)">
          {filtered.length} {filtered.length === 1 ? 'activity' : 'activities'}
        </p>

        <div className="flex gap-2">
          {/* Filter dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => (filterOpen ? setFilterOpen(false) : openFilter())}
              className={`px-3 py-1.5 text-xs rounded-(--radius-s) border bg-(--card) transition-colors cursor-pointer ${
                hasChanges
                  ? 'border-(--accent) text-(--accent)'
                  : 'border-(--line) text-(--ink-3) hover:text-(--ink)'
              }`}
            >
              Filter
            </button>

            {filterOpen && (
              <div className="absolute right-0 top-full mt-1.5 bg-(--card) border border-(--line) rounded-xl shadow-(--shadow-m) z-20">
                <div className="flex divide-x divide-(--line)">
                  {/* Left column — Sport + Intensity */}
                  <div className="w-48 py-2">
                    {/* Sport */}
                    <div className="px-3 py-1.5">
                      <span className="text-eyebrow">
                        Sport
                      </span>
                    </div>
                    {SPORT_OPTIONS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setDraftSport(s.key)}
                        className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                          draftSport === s.key
                            ? 'text-(--accent) bg-(--accent-soft)/30'
                            : 'text-(--ink-2) hover:bg-(--bg-2)'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}

                    <div className="my-1.5 border-t border-(--line)" />

                    {/* Intensity */}
                    <div className="px-3 py-1.5">
                      <span className="text-eyebrow">
                        Intensity
                      </span>
                    </div>
                    {INTENSITY_OPTIONS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => setDraftIntensity(f.key)}
                        className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                          draftIntensity === f.key
                            ? 'text-(--accent) bg-(--accent-soft)/30'
                            : 'text-(--ink-2) hover:bg-(--bg-2)'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Right column — Columns (2-col grid) */}
                  <div className="w-64 py-2">
                    <div className="px-3 py-1.5">
                      <span className="text-eyebrow">
                        Columns
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-1">
                      {TOGGLEABLE_COLS.map((col) => {
                        const checked = draftCols.has(col.key)
                        return (
                          <button
                            key={col.key}
                            type="button"
                            onClick={() => toggleDraftCol(col.key)}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer transition-colors text-(--ink-2) hover:bg-(--bg-2) rounded"
                          >
                            <span
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                checked
                                  ? 'bg-(--accent) border-(--accent)'
                                  : 'border-(--ink-4) bg-transparent'
                              }`}
                            >
                              {checked && (
                                <svg
                                  className="w-2.5 h-2.5 text-white"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  strokeWidth={3}
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m4.5 12.75 6 6 9-13.5"
                                  />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{col.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="border-t border-(--line) px-3 py-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-xs text-(--ink-3) hover:text-(--ink) cursor-pointer transition-colors"
                  >
                    Clear filters
                  </button>
                  <button
                    type="button"
                    onClick={applyDraft}
                    className="px-3 py-1.5 text-xs rounded-(--radius-s) bg-(--accent) text-white font-medium cursor-pointer hover:opacity-90 transition-opacity"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded-(--radius-s) border border-(--line) bg-(--card) text-(--ink-3) hover:text-(--ink) transition-colors cursor-pointer"
          >
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-(--card-2) text-(--ink-4) text-left">
                {visibleCols.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-(--ink-2) transition-colors whitespace-nowrap ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                  >
                    {col.label}
                    {sortCol === col.key && (
                      <span className="ml-1 text-(--accent)">
                        {sortDir === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-(--line) hover:bg-(--bg-2) transition-colors"
                >
                  {visibleCols.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-3 ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                      }`}
                    >
                      <Cell run={run} col={col.key} unit={unit} unitLabel={unitLabel} paceLabel={paceLabel} />
                    </td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={visibleCols.length}
                    className="px-4 py-8 text-center text-(--ink-4)"
                  >
                    No activities match this filter
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// ── Cell renderer ──────────────────────────────────────────────────

function Cell({
  run,
  col,
  unit,
  unitLabel,
  paceLabel,
}: {
  run: Activity
  col: SortCol
  unit: Unit
  unitLabel: string
  paceLabel: string
}) {
  switch (col) {
    case 'name':
      return (
        <ActivityLink
          activityId={run.id}
          className="truncate max-w-50 inline-block"
        >
          {run.name}
        </ActivityLink>
      )
    case 'date':
      return (
        <span className="text-(--ink-3) whitespace-nowrap">
          {new Date(run.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      )
    case 'distance':
      return (
        <span className="font-mono tabular-nums">
          {toDisplayDistance(run.distanceMeters, unit)} {unitLabel}
        </span>
      )
    case 'time':
      return (
        <span className="font-mono tabular-nums">
          {formatDuration(run.movingTime)}
        </span>
      )
    case 'pace':
      return (
        <span className="font-mono tabular-nums">
          {formatPace(paceForUnit(run.avgSpeed, unit))} {paceLabel}
        </span>
      )
    case 'avgHr':
      return <Mono value={run.avgHr} />
    case 'maxHr':
      return <Mono value={run.maxHr} />
    case 'cadence':
      return <Mono value={run.cadence} />
    case 'elevation':
      return (
        <span className="font-mono tabular-nums">
          {Math.round(run.elevation)}m
        </span>
      )
    case '1k':
    case '1 mile':
    case '5k':
    case '10k':
    case 'Half-Marathon':
    case 'Marathon': {
      const t = run.bestEfforts[col]
      return t !== undefined ? (
        <span className="font-mono tabular-nums">{formatDuration(t)}</span>
      ) : (
        <span className="text-(--ink-4)">{'—'}</span>
      )
    }
    default:
      return null
  }
}

function Mono({ value }: { value: number | null }) {
  return (
    <span className="font-mono tabular-nums">
      {value !== null ? value : '—'}
    </span>
  )
}
