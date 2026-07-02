/**
 * Gear tab — shoes/bikes with lifetime mileage, mirrored read-only from
 * Strava. Active gear first, retired collapsed below at reduced emphasis.
 */

import { LuFootprints } from 'react-icons/lu'
import Card from '@/features/dashboard/ui/Card'
import { distanceUnit, toDisplayDistance, type Unit } from '@/lib/activities'
import type { GearItem } from '../api/getGearData.server'

export default function GearTab({
  gear,
  unit,
}: {
  gear: GearItem[]
  unit: Unit
}) {
  if (gear.length === 0) {
    return <EmptyGear />
  }

  const active = gear.filter((g) => !g.retired)
  const retired = gear.filter((g) => g.retired)
  const distLabel = distanceUnit(unit)

  return (
    <>
      <div>
        <h2 className="text-section text-(--ink)">Gear</h2>
        <div className="text-meta">Shoe mileage, mirrored from Strava</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {active.map((g) => (
          <GearCard key={g.id} g={g} unit={unit} distLabel={distLabel} />
        ))}
      </div>

      {retired.length > 0 && (
        <>
          <h3 className="text-xs font-medium text-(--ink-3) uppercase tracking-wider mt-2">
            Retired
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {retired.map((g) => (
              <GearCard
                key={g.id}
                g={g}
                unit={unit}
                distLabel={distLabel}
                dimmed
              />
            ))}
          </div>
        </>
      )}
    </>
  )
}

/**
 * Designed empty state (same visual language as the records tab's):
 * icon + pitch, plus ghost cards previewing what a filled tab looks
 * like so the page doesn't read as a void.
 */
function EmptyGear() {
  return (
    <div className="py-16 px-10 text-center border border-dashed border-(--line) rounded-(--radius-l) bg-(--card-2)">
      <div className="w-15 h-15 mx-auto mb-5 rounded-full bg-(--accent-soft) grid place-items-center text-(--accent)">
        <LuFootprints size={28} />
      </div>
      <h2 className="text-xl font-medium m-0 mb-2 text-(--ink) tracking-tight">
        Your shoes will live here.
      </h2>
      <p className="text-sm text-(--ink-3) mx-auto max-w-[46ch] leading-relaxed">
        Assign shoes to your runs on Strava and they&apos;ll appear on the next
        sync — lifetime mileage, run counts, and when it&apos;s time to retire a
        pair.
      </p>

      <div
        aria-hidden="true"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-10 max-w-xl mx-auto select-none"
      >
        {[52, 34].map((w) => (
          <div
            key={w}
            className="p-4 flex items-center justify-between gap-4 rounded-(--radius-m) border border-(--line) bg-(--card) opacity-50"
          >
            <div className="min-w-0 flex-1">
              <div
                className="h-3 rounded bg-(--ink-4) opacity-30"
                style={{ width: `${w}%` }}
              />
              <div className="h-2 rounded bg-(--ink-4) opacity-20 mt-2 w-1/3" />
            </div>
            <div className="text-right shrink-0">
              <div className="h-4 w-12 rounded bg-(--ink-4) opacity-30 ml-auto" />
              <div className="h-2 w-6 rounded bg-(--ink-4) opacity-20 mt-1.5 ml-auto" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GearCard({
  g,
  unit,
  distLabel,
  dimmed,
}: {
  g: GearItem
  unit: Unit
  distLabel: string
  dimmed?: boolean
}) {
  const subtitle = [g.brandName, g.modelName].filter(Boolean).join(' ')
  return (
    <Card
      className={`p-4 flex items-center justify-between gap-4 ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-(--ink) font-medium truncate">
            {g.nickname || g.name}
          </span>
          {g.isPrimary && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-(--accent-soft) text-(--ink-2) shrink-0">
              Primary
            </span>
          )}
        </div>
        {subtitle && <div className="text-meta truncate">{subtitle}</div>}
        <div className="text-xs text-(--ink-4) mt-0.5">
          {g.activityCount} {g.activityCount === 1 ? 'run' : 'runs'} tracked
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-mono tabular-nums text-(--ink) text-lg">
          {toDisplayDistance(g.distanceMeters, unit)}
        </div>
        <div className="text-meta">{distLabel}</div>
      </div>
    </Card>
  )
}
