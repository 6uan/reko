/**
 * Recent runs table — last 8 runs overall.
 */

import { useMemo } from 'react'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table'
import { formatPace, formatDuration } from '@/lib/strava'
import {
  toDisplayDistance,
  paceForUnit,
  distanceUnit,
  paceUnit,
  type Activity,
  type Unit,
} from '@/lib/activities'
import { formatDateShort } from '@/lib/dates'
import Table from '@/features/dashboard/ui/Table'
import ActivityLink from '@/features/dashboard/ui/ActivityLink'

type Props = {
  runs: Activity[]
  unit: Unit
}

const col = createColumnHelper<Activity>()

function buildColumns(unit: Unit) {
  const unitLabel = distanceUnit(unit)
  const paceLabel = paceUnit(unit)

  return [
    col.accessor('name', {
      id: 'name',
      header: 'Activity',
      cell: (info) => (
        <ActivityLink activityId={info.row.original.id} className="truncate max-w-50 inline-block">
          {info.getValue()}
        </ActivityLink>
      ),
    }),
    col.accessor('date', {
      id: 'date',
      header: 'Date',
      cell: (info) => (
        <span className="text-(--ink-3) whitespace-nowrap">{formatDateShort(info.getValue())}</span>
      ),
    }),
    col.accessor('distanceMeters', {
      id: 'distance',
      header: 'Distance',
      meta: { align: 'right' },
      cell: (info) => (
        <span className="font-mono tabular-nums">
          {toDisplayDistance(info.getValue(), unit)} {unitLabel}
        </span>
      ),
    }),
    col.accessor('movingTime', {
      id: 'time',
      header: 'Time',
      meta: { align: 'right' },
      cell: (info) => (
        <span className="font-mono tabular-nums">{formatDuration(info.getValue())}</span>
      ),
    }),
    col.accessor((r) => paceForUnit(r.avgSpeed, unit), {
      id: 'pace',
      header: 'Pace',
      meta: { align: 'right' },
      cell: (info) => (
        <span className="font-mono tabular-nums">
          {formatPace(info.getValue())} {paceLabel}
        </span>
      ),
    }),
    col.accessor('avgHr', {
      id: 'avgHr',
      header: 'Avg HR',
      meta: { align: 'right' },
      cell: (info) => (
        <span className="font-mono tabular-nums">
          {info.getValue() !== null ? info.getValue() : '—'}
        </span>
      ),
    }),
    col.accessor('elevation', {
      id: 'elevation',
      header: 'Elev',
      meta: { align: 'right' },
      cell: (info) => (
        <span className="font-mono tabular-nums">
          {info.getValue() > 0 ? `${Math.round(info.getValue())}m` : '—'}
        </span>
      ),
    }),
    col.accessor('prCount', {
      id: 'pr',
      header: 'PR',
      meta: { align: 'center' },
      cell: (info) =>
        info.getValue() > 0 ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-(--accent-soft) text-(--accent) text-[11px] font-medium">
            {info.getValue()} PR
          </span>
        ) : (
          <span className="text-(--ink-4)">—</span>
        ),
    }),
  ]
}

export default function RecentRunsTable({ runs, unit }: Props) {
  const columns = useMemo(() => buildColumns(unit), [unit])

  const table = useReactTable({
    data: runs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <Table table={table} title="Recent Runs" minWidth="700px" emptyMessage="No runs yet" />
}
