import { useState, useMemo, useRef, useEffect } from 'react'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type VisibilityState,
  type RowData,
} from '@tanstack/react-table'
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
import { formatDateShort } from '@/lib/dates'
import Table from '@/features/dashboard/ui/Table'
import ActivityLink from '@/features/dashboard/ui/ActivityLink'

// ── Table meta (display-only state, not sort-affecting) ───────────

type TableMeta = { unit: Unit; unitLabel: string; paceLabel: string }

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    unit: Unit
    unitLabel: string
    paceLabel: string
  }
}

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

// ── Column config ──────────────────────────────────────────────────

type ColKey =
  | 'name' | 'date' | 'distance' | 'time' | 'pace'
  | 'avgHr' | 'maxHr' | 'cadence' | 'elevation'
  | '1k' | '1mile' | '5k' | '10k' | 'halfMarathon' | 'marathon'

type ToggleableDef = { key: ColKey; label: string; defaultOn: boolean }

const TOGGLEABLE_COLS: ToggleableDef[] = [
  { key: 'avgHr', label: 'Avg HR', defaultOn: true },
  { key: 'maxHr', label: 'Max HR', defaultOn: false },
  { key: 'cadence', label: 'Cadence', defaultOn: true },
  { key: '1k', label: '1K', defaultOn: true },
  { key: '1mile', label: 'Mile', defaultOn: true },
  { key: '5k', label: '5K', defaultOn: true },
  { key: '10k', label: '10K', defaultOn: false },
  { key: 'halfMarathon', label: 'Half Marathon', defaultOn: false },
  { key: 'marathon', label: 'Marathon', defaultOn: false },
  { key: 'elevation', label: 'Elevation', defaultOn: false },
]

const DEFAULT_VISIBILITY: VisibilityState = Object.fromEntries(
  TOGGLEABLE_COLS.map((c) => [c.key, c.defaultOn]),
)

// ── Effort key mapping ────────────────────────────────────────────

const EFFORT_KEYS = ['1k', '1mile', '5k', '10k', 'halfMarathon', 'marathon'] as const
type EffortColKey = (typeof EFFORT_KEYS)[number]

const EFFORT_KEY_MAP: Record<EffortColKey, keyof BestEffortTimes> = {
  '1k': '1k',
  '1mile': '1 mile',
  '5k': '5k',
  '10k': '10k',
  halfMarathon: 'Half-Marathon',
  marathon: 'Marathon',
}

// ── Pre-resolved effort value per row ─────────────────────────────

type ResolvedEffort = { time: number; isComputed: boolean } | undefined
type EffortValues = Record<EffortColKey, ResolvedEffort>

type TableRow = Activity & { _efforts: EffortValues }

function resolveEfforts(run: Activity, showComputed: boolean): EffortValues {
  const out = {} as EffortValues
  for (const colKey of EFFORT_KEYS) {
    const effortKey = EFFORT_KEY_MAP[colKey]
    const strava = run.bestEfforts[effortKey]
    if (strava != null) {
      out[colKey] = { time: strava, isComputed: false }
    } else if (showComputed) {
      const derived = run.derivedBestEfforts[effortKey]
      out[colKey] = derived != null ? { time: derived, isComputed: true } : undefined
    } else {
      out[colKey] = undefined
    }
  }
  return out
}

// ── Column definitions (stable — no external state in closures) ───

const col = createColumnHelper<TableRow>()

/**
 * Columns are defined once. Accessors use raw numeric values (sort-
 * correct regardless of unit). Cell renderers read `unit` from
 * table.options.meta for display formatting.
 */
const COLUMNS = [
  col.accessor('name', {
    id: 'name',
    header: 'Activity',
    meta: { align: 'left' },
    cell: (info) => (
      <ActivityLink activityId={info.row.original.id} className="truncate max-w-50 inline-block">
        {info.getValue()}
      </ActivityLink>
    ),
  }),
  col.accessor('date', {
    id: 'date',
    header: 'Date',
    meta: { align: 'left' },
    sortingFn: (a, b) =>
      new Date(a.original.date).getTime() - new Date(b.original.date).getTime(),
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">{formatDateShort(info.getValue())}</span>
    ),
  }),
  col.accessor('distanceMeters', {
    id: 'distance',
    header: 'Distance',
    meta: { align: 'right' },
    cell: (info) => {
      const { unit, unitLabel } = info.table.options.meta as TableMeta
      return (
        <span className="font-mono tabular-nums">
          {toDisplayDistance(info.getValue(), unit)} {unitLabel}
        </span>
      )
    },
  }),
  col.accessor('movingTime', {
    id: 'time',
    header: 'Time',
    meta: { align: 'right' },
    cell: (info) => (
      <span className="font-mono tabular-nums">{formatDuration(info.getValue())}</span>
    ),
  }),
  // Accessor uses raw avgSpeed (higher = faster). Sort descending
  // on first click so fastest appears first.
  col.accessor('avgSpeed', {
    id: 'pace',
    header: 'Pace',
    meta: { align: 'right' },
    sortDescFirst: true,
    cell: (info) => {
      const { unit, paceLabel } = info.table.options.meta as TableMeta
      return (
        <span className="font-mono tabular-nums">
          {formatPace(paceForUnit(info.getValue(), unit))} {paceLabel}
        </span>
      )
    },
  }),
  col.accessor('avgHr', {
    id: 'avgHr',
    header: 'Avg HR',
    meta: { align: 'right' },
    sortUndefined: 'last',
    cell: (info) => <Mono value={info.getValue()} />,
  }),
  col.accessor('maxHr', {
    id: 'maxHr',
    header: 'Max HR',
    meta: { align: 'right' },
    sortUndefined: 'last',
    cell: (info) => <Mono value={info.getValue()} />,
  }),
  col.accessor('cadence', {
    id: 'cadence',
    header: 'Cadence',
    meta: { align: 'right' },
    sortUndefined: 'last',
    cell: (info) => <Mono value={info.getValue()} />,
  }),
  // Best-effort columns — read from pre-resolved _efforts
  ...EFFORT_KEYS.map((key) =>
    col.accessor((r) => r._efforts[key]?.time, {
      id: key,
      header: TOGGLEABLE_COLS.find((c) => c.key === key)!.label,
      meta: { align: 'right' },
      sortUndefined: 'last',
      sortDescFirst: false,
      cell: (info) => {
        const effort = info.row.original._efforts[key]
        if (!effort) return <span className="text-(--ink-4)">—</span>
        const borderColor = effort.isComputed ? 'border-(--line)' : 'border-transparent'
        return (
          <span className={`inline-block font-mono tabular-nums border ${borderColor} rounded-(--radius-s) px-2 py-0.5`}>
            {formatDuration(effort.time)}
          </span>
        )
      },
    }),
  ),
  col.accessor('elevation', {
    id: 'elevation',
    header: 'Elevation',
    meta: { align: 'right' },
    cell: (info) => (
      <span className="font-mono tabular-nums">{Math.round(info.getValue())}m</span>
    ),
  }),
]

// ── Component ──────────────────────────────────────────────────────

export default function Activities({ activities, unit }: Props) {
  const [sportFilter, setSportFilter] = useState<SportFilter>('all')
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [sorting, setSorting] = useState<SortingState>([{ id: 'date', desc: true }])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY)
  const [filterOpen, setFilterOpen] = useState(false)
  const [showComputed, setShowComputed] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  // Draft state for the dropdown — only committed on Apply.
  const [draftSport, setDraftSport] = useState<SportFilter>(sportFilter)
  const [draftIntensity, setDraftIntensity] = useState<FilterKey>(activeFilter)
  const [draftVisibility, setDraftVisibility] = useState<VisibilityState>(columnVisibility)

  function openFilter() {
    setDraftSport(sportFilter)
    setDraftIntensity(activeFilter)
    setDraftVisibility({ ...columnVisibility })
    setFilterOpen(true)
  }

  function applyDraft() {
    setSportFilter(draftSport)
    setActiveFilter(draftIntensity)
    setColumnVisibility({ ...draftVisibility })
    setFilterOpen(false)
  }

  function clearAll() {
    setDraftSport('all')
    setDraftIntensity('all')
    setDraftVisibility({ ...DEFAULT_VISIBILITY })
  }

  function toggleDraftCol(key: ColKey) {
    setDraftVisibility((prev) => ({ ...prev, [key]: !prev[key] }))
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

  // Pre-resolve effort values into new row objects.
  // When `showComputed` changes, new objects → TanStack re-sorts.
  const tableData = useMemo<TableRow[]>(() => {
    const bySport = applySportFilter(activities, sportFilter)
    const filtered = applyFilter(bySport, activeFilter)
    return filtered.map((r) => ({ ...r, _efforts: resolveEfforts(r, showComputed) }))
  }, [activities, sportFilter, activeFilter, showComputed])

  // Unit passed via meta — cell renderers read it, columns stay stable.
  const meta = useMemo<TableMeta>(
    () => ({ unit, unitLabel: distanceUnit(unit), paceLabel: paceUnit(unit) }),
    [unit],
  )

  const table = useReactTable({
    data: tableData,
    columns: COLUMNS,
    meta,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const hasActiveFilter = sportFilter !== 'all' || activeFilter !== 'all'
  const hasCustomCols = Object.entries(columnVisibility).some(
    ([k, v]) => DEFAULT_VISIBILITY[k] !== v,
  )
  const hasChanges = hasActiveFilter || hasCustomCols

  return (
    <div className="space-y-4">
      {/* Top bar — count + actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-(--ink-3)">
          {tableData.length} {tableData.length === 1 ? 'activity' : 'activities'}
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowComputed((v) => !v)}
            aria-pressed={showComputed}
            className={`px-3 py-1.5 text-xs rounded-(--radius-s) border bg-(--card) transition-colors cursor-pointer ${
              showComputed
                ? 'border-(--accent) text-(--accent)'
                : 'border-(--line) text-(--ink-3) hover:text-(--ink)'
            }`}
          >
            Estimated splits
          </button>

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
                    <div className="px-3 py-1.5">
                      <span className="text-eyebrow">Sport</span>
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

                    <div className="px-3 py-1.5">
                      <span className="text-eyebrow">Intensity</span>
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
                      <span className="text-eyebrow">Columns</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-1">
                      {TOGGLEABLE_COLS.map((c) => {
                        const checked = draftVisibility[c.key] !== false
                        return (
                          <button
                            key={c.key}
                            type="button"
                            onClick={() => toggleDraftCol(c.key)}
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
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{c.label}</span>
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
      <Table table={table} minWidth="800px" emptyMessage="No activities match this filter" />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────

function Mono({ value }: { value: number | null }) {
  return (
    <span className="font-mono tabular-nums">
      {value !== null ? value : '—'}
    </span>
  )
}
