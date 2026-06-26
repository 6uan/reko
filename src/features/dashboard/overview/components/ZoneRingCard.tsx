/**
 * Standalone card for the HR-zone activity ring (time-in-zone distribution),
 * with avg HR in the center. Sits between the heatmap and the stat card.
 */

import Card from '@/features/dashboard/ui/Card'
import HrZoneRing from '@/features/dashboard/ui/HrZoneRing'

export default function ZoneRingCard({
  zoneSeconds,
  avgHr,
}: {
  zoneSeconds: number[]
  avgHr: number | null
}) {
  return (
    <Card className="h-full p-4 flex flex-col items-center justify-center gap-2">
      <HrZoneRing
        zoneSeconds={zoneSeconds}
        size={116}
        center={
          <>
            <span className="text-2xl font-semibold tabular-nums text-(--ink)">
              {avgHr ?? '—'}
            </span>
            <span className="mt-0.5 text-[10px] text-(--ink-4)">bpm</span>
          </>
        }
      />
      <span className="text-[10px] uppercase tracking-wider text-(--ink-4)">
        Time in zones
      </span>
    </Card>
  )
}
