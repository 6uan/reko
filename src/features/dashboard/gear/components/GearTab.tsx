/**
 * Gear tab — shoes/bikes with lifetime mileage, mirrored read-only from
 * Strava. Active gear first, retired collapsed below at reduced emphasis.
 */

import Card from '@/features/dashboard/ui/Card'
import EmptyState from '@/features/dashboard/ui/EmptyState'
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
    return (
      <Card className="p-10">
        <EmptyState>
          No gear yet. Assign shoes to your runs on Strava, then resync — they
          show up here with mileage.
        </EmptyState>
      </Card>
    )
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
