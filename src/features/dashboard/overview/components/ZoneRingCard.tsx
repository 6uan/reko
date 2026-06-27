/**
 * Standalone card for the HR-zone activity ring (time-in-zone distribution),
 * with avg HR in the center and a per-zone legend (colour · name · share).
 * Sits between the heatmap and the stat card.
 */

import Card from '@/features/dashboard/ui/Card'
import HrZoneRing from '@/features/dashboard/ui/HrZoneRing'
import { HR_ZONES } from '@/lib/heartRate'

export default function ZoneRingCard({
  zoneSeconds,
  avgHr,
}: {
  zoneSeconds: number[]
  avgHr: number | null
}) {
  const total = zoneSeconds.reduce((a, b) => a + b, 0)

  return (
    <Card className="flex items-center gap-4 p-4 lg:h-full lg:flex-col lg:justify-center lg:gap-3">
      <div className="shrink-0">
        <HrZoneRing
          zoneSeconds={zoneSeconds}
          size={96}
          center={
            <>
              <span className="text-xl font-semibold tabular-nums text-(--ink)">
                {avgHr ?? '—'}
              </span>
              <span className="text-[9px] text-(--ink-4)">bpm</span>
            </>
          }
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 lg:w-full lg:flex-none">
        {HR_ZONES.map((z, i) => {
          const pct = total > 0 ? Math.round((zoneSeconds[i] / total) * 100) : 0
          return (
            <div key={z.name} className="flex items-center gap-1.5 text-[10px]">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: z.color }}
              />
              <span className="truncate text-(--ink-3)">{z.name}</span>
              <span className="ml-auto tabular-nums text-(--ink-4)">{pct}%</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
