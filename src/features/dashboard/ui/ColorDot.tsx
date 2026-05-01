/**
 * Small colored circle used as a legend bullet next to zone labels.
 */

type Props = {
  color: string
  className?: string
}

export default function ColorDot({ color, className = '' }: Props) {
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full shrink-0 ${className}`.trim()}
      style={{ background: color }}
    />
  )
}
