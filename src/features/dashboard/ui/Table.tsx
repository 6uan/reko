/**
 * Shared data table built on @tanstack/react-table.
 *
 * Headless engine handles sorting, column visibility, etc.
 * This component owns the styled shell: Card wrap, horizontal scroll,
 * header row, hover states, empty state.
 *
 * Usage (simple — no interactivity):
 *   <Table table={table} minWidth="600px" title="Fastest runs" />
 *
 * The consumer creates the table instance via `useReactTable` and passes
 * it in. This keeps the component flexible — any TanStack Table feature
 * (sorting, filtering, pagination, column pinning) works automatically.
 */

import {
  flexRender,
  type Table as TanStackTable,
} from '@tanstack/react-table'
import Card from './Card'
import SectionHeader from './SectionHeader'

type Props<T> = {
  table: TanStackTable<T>
  title?: string
  subtitle?: string
  minWidth?: string
  emptyMessage?: string
}

export default function Table<T>({
  table,
  title,
  subtitle,
  minWidth = '600px',
  emptyMessage = 'No data',
}: Props<T>) {
  const rows = table.getRowModel().rows

  return (
    <Card className="overflow-hidden">
      {title && (
        <div className="px-4 py-3 border-b border-(--line)">
          <SectionHeader title={title} subtitle={subtitle} />
        </div>
      )}
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm text-left border-collapse"
          style={{ minWidth }}
        >
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="bg-(--card-2)">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  const align = (header.column.columnDef.meta as { align?: string })?.align

                  const alignClass =
                    align === 'right'
                      ? 'text-right'
                      : align === 'center'
                        ? 'text-center'
                        : 'text-left'

                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`text-eyebrow font-medium px-4 py-2.5 whitespace-nowrap ${alignClass} ${
                        canSort ? 'cursor-pointer select-none hover:text-(--ink-2) transition-colors' : ''
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted && (
                        <span className="ml-1 text-(--accent)">
                          {sorted === 'asc' ? '↑' : '↓'}
                        </span>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                className="border-t border-(--line) hover:bg-(--bg-2) transition-colors"
              >
                {row.getVisibleCells().map((cell) => {
                  const align = (cell.column.columnDef.meta as { align?: string })?.align

                  const alignClass =
                    align === 'right'
                      ? 'text-right'
                      : align === 'center'
                        ? 'text-center'
                        : 'text-left'

                  return (
                    <td key={cell.id} className={`px-4 py-3 ${alignClass}`}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  )
                })}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={table.getVisibleLeafColumns().length}
                  className="px-4 py-8 text-center text-(--ink-4)"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
