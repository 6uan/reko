/**
 * Stat tile used at the top of every dashboard tab.
 *
 *   ┌─────────────────────────┐
 *   │ LABEL                   │  ← uppercase eyebrow (text-(--ink-4))
 *   │ 8:53 /km                │  ← big mono number + unit
 *   │ 29 runs                 │  ← detail line
 *   └─────────────────────────┘
 *
 * `accent` colors the numeric value (positive=green, negative=red) for
 * trend-style cards (e.g. Cadence "TREND -3 spm").
 */

import Card from './Card'

type Props = {
  label: string
  value: string | number
  unit?: string
  detail?: string
  accent?: 'positive' | 'negative'
}

export default function KpiCard({ label, value, unit, detail, accent }: Props) {
  const valueColor =
    accent === 'positive' ? 'text-(--ok)' : accent === 'negative' ? 'text-(--bad)' : ''

  return (
    <Card className="p-4">
      <div className="text-eyebrow">{label}</div>
      <div className="text-stat mt-1.5">
        <span className={valueColor}>{value}</span>
        {unit && <span className="text-sm text-(--ink-3) ml-0.5 font-normal">{unit}</span>}
      </div>
      {detail && <div className="text-detail mt-1.5">{detail}</div>}
    </Card>
  )
}
