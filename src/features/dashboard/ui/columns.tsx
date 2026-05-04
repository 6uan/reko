/**
 * Shared column definition factories for TanStack Table.
 *
 * Each factory returns a column config object that can be spread into
 * a columns array. Uses `createColumnHelper<any>()` internally — the
 * type safety comes from the table's data type, not the column helper.
 */

import { createColumnHelper } from '@tanstack/react-table'
import { formatPace, formatDuration } from '@/lib/strava'
import { toDisplayDistance, paceForUnit, paceUnit, distanceUnit, type Unit } from '@/lib/activities'
import { formatDate, formatDateShort } from '@/lib/dates'
import ActivityLink from './ActivityLink'

// Generic helper — works with any row type that has the required fields.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const col = createColumnHelper<any>()

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

/** Date column with full format (e.g. "Apr 24, 2026"). Row must have `date`. */
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
export function distanceColumn(unit: Unit) {
  return col.accessor('distanceMeters', {
    id: 'distance',
    header: 'Distance',
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
        {toDisplayDistance(info.getValue(), unit)} {distanceUnit(unit)}
      </span>
    ),
  })
}

/** Moving time column. Row must have `movingTime`. */
export function timeColumn() {
  return col.accessor('movingTime', {
    id: 'time',
    header: 'Time',
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
        {formatDuration(info.getValue())}
      </span>
    ),
  })
}

/** Pace column derived from avgSpeed. Row must have `avgSpeed`. */
export function paceColumn(unit: Unit) {
  const unitLabel = paceUnit(unit)
  return col.accessor((r) => paceForUnit(r.avgSpeed, unit), {
    id: 'pace',
    header: 'Pace',
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
        {formatPace(info.getValue())} {unitLabel}
      </span>
    ),
  })
}

/** Average heart rate column. Row must have `avgHr`. */
export function avgHrColumn() {
  return col.accessor('avgHr', {
    id: 'avgHr',
    header: 'Avg HR',
    cell: (info) => (
      <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
        {info.getValue() !== null ? `${Math.round(info.getValue()!)} bpm` : '—'}
      </span>
    ),
  })
}
