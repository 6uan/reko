/**
 * Recent runs table — last 8 runs overall.
 */

import { useMemo } from 'react'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table'
import { type Activity, type Unit } from '@/lib/activities'
import Table from '@/features/dashboard/ui/Table'
import {
  nameColumn,
  dateColumn,
  distanceColumn,
  timeColumn,
  paceColumn,
  avgHrColumn,
} from '@/features/dashboard/ui/columns'

type Props = {
  runs: Activity[]
  unit: Unit
}

const col = createColumnHelper<Activity>()

function buildColumns(unit: Unit) {
  // Right-aligned, default-color cells with a raw avg-HR value — these opts
  // preserve this table's existing look while the factory owns the shared
  // formatting. Elevation + PR are bespoke to this table, so stay inline.
  const right = { align: 'right' as const, muted: false }

  return [
    nameColumn<Activity>(),
    dateColumn<Activity>(true),
    distanceColumn<Activity>(unit, right),
    timeColumn<Activity>(right),
    paceColumn<Activity>(unit, right),
    avgHrColumn<Activity>({ ...right, raw: true }),
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
