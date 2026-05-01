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
      <h3 className="text-section">{title}</h3>
      {subtitle && <span className="text-meta">{subtitle}</span>}
    </div>
  )
}
