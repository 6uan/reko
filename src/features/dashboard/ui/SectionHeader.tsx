/**
 * Header for chart / table cards. Title on the left, optional muted
 * subtitle on the right (e.g. "29 runs", "All time", "12 weeks").
 */

type Props = {
  title: string
  subtitle?: string
}

export default function SectionHeader({ title, subtitle }: Props) {
  return (
    <div className="flex justify-between items-baseline">
      <h3 className="text-[15px] font-medium text-(--ink)">{title}</h3>
      {subtitle && (
        <span className="font-mono text-[11px] text-(--ink-4)">{subtitle}</span>
      )}
    </div>
  )
}
