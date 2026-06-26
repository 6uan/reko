/**
 * Shared column definition factories for TanStack Table.
 *
 * Each factory returns a column config object that can be spread into a
 * columns array. Numeric/value columns accept an optional `opts` so a table
 * can vary presentation (alignment, muted vs default text, raw vs formatted
 * HR) while the value-formatting logic lives in one place. Defaults reproduce
 * the original muted, left-aligned style. Uses `createColumnHelper<any>()` —
 * the type safety comes from the table's data type, not the column helper.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { formatPace, formatDuration } from '@/lib/strava'
import { toDisplayDistance, paceForUnit, paceUnit, distanceUnit, type Unit } from '@/lib/activities'
import { formatDate, formatDateShort } from '@/lib/dates'
import ActivityLink from './ActivityLink'

// Generic helper — works with any row type that has the required fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const col = createColumnHelper<any>()

/** Per-table presentation overrides for value cells. */
export type CellOpts = {
  /** Column alignment, applied via the Table's `meta.align`. Default left. */
  align?: 'right' | 'center'
  /** Muted ink-3 text (default). Set false to inherit the default text color. */
  muted?: boolean
}

const numClass = (opts?: CellOpts) =>
  `font-mono tabular-nums whitespace-nowrap${opts?.muted === false ? '' : ' text-(--ink-3)'}`

const alignMeta = (opts?: CellOpts) =>
  opts?.align ? { meta: { align: opts.align } } : {}

/** Rank column (#1, #2, …) based on row index. */
export function rankColumn() {
  return col.display({
    id: 'rank',
    header: '#',
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3)">{info.row.index + 1}</span>
    ),
  })
}

/** Activity name that links to Strava. Row must have `id` and `name`. */
export function nameColumn() {
  return col.accessor('name', {
    id: 'name',
    header: 'Activity',
    cell: (info) => (
      <ActivityLink activityId={info.row.original.id} className="truncate max-w-50 inline-block">
        {info.getValue()}
      </ActivityLink>
    ),
  })
}

/** Date column. `short` uses the compact format (e.g. "4/24"). Row must have `date`. */
export function dateColumn(short = false) {
  return col.accessor('date', {
    id: 'date',
    header: 'Date',
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
        {short ? formatDateShort(info.getValue()) : formatDate(info.getValue())}
      </span>
    ),
  })
}

/** Distance column. Row must have `distanceMeters`. */
export function distanceColumn(unit: Unit, opts?: CellOpts) {
  return col.accessor('distanceMeters', {
    id: 'distance',
    header: 'Distance',
    ...alignMeta(opts),
    cell: (info) => (
      <span className={numClass(opts)}>
        {toDisplayDistance(info.getValue(), unit)} {distanceUnit(unit)}
      </span>
    ),
  })
}

/** Moving time column. Row must have `movingTime`. */
export function timeColumn(opts?: CellOpts) {
  return col.accessor('movingTime', {
    id: 'time',
    header: 'Time',
    ...alignMeta(opts),
    cell: (info) => (
      <span className={numClass(opts)}>{formatDuration(info.getValue())}</span>
    ),
  })
}

/** Pace column derived from avgSpeed. Row must have `avgSpeed`. */
export function paceColumn(unit: Unit, opts?: CellOpts) {
  const unitLabel = paceUnit(unit)
  return col.accessor((r) => paceForUnit(r.avgSpeed, unit), {
    id: 'pace',
    header: 'Pace',
    ...alignMeta(opts),
    cell: (info) => (
      <span className={numClass(opts)}>
        {formatPace(info.getValue())} {unitLabel}
      </span>
    ),
  })
}

/** Average heart rate column. Row must have `avgHr`. `raw` prints the value unformatted. */
export function avgHrColumn(opts?: CellOpts & { raw?: boolean }) {
  return col.accessor('avgHr', {
    id: 'avgHr',
    header: 'Avg HR',
    ...alignMeta(opts),
    cell: (info) => {
      const v = info.getValue()
      return (
        <span className={numClass(opts)}>
          {v !== null ? (opts?.raw ? v : `${Math.round(v)} bpm`) : '—'}
        </span>
      )
    },
  })
}
