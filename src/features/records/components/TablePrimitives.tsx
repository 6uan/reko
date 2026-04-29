/** Tiny table header / cell primitives shared by PaceByRange and PRHistory. */

export function Th({
  children,
  align,
}: {
  children?: React.ReactNode
  align?: 'right'
}) {
  return (
    <th
      className={`bg-(--card-2) font-mono text-[10px] uppercase tracking-[0.08em] text-(--ink-4) px-3 py-2.5 font-medium border-b border-(--line) ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  className = '',
  align,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'right'
}) {
  return (
    <td
      className={`px-3 py-3 border-b border-(--line-2) text-[13px] ${
        align === 'right' ? 'text-right' : ''
      } ${className}`}
    >
      {children}
    </td>
  )
}
