import { useMemo } from 'react'
import { formatPace } from '@/lib/strava'
import { paceForUnit, avg, type Activity, type Unit } from '@/lib/activities'
import KpiCard from '@/features/dashboard/ui/KpiCard'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import Card from '@/features/dashboard/ui/Card'
import Th from '@/features/dashboard/ui/Th'
import ColorDot from '@/features/dashboard/ui/ColorDot'
import ZoneBar from '@/features/dashboard/ui/ZoneBar'

type Props = { runs: Activity[]; unit: Unit }

// ── Zone definitions (fixed — not from Strava's /athlete/zones) ──

const ZONES = [
  { name: 'Z1 Recovery', min: 0, max: 124, color: 'var(--hr-1)' },
  { name: 'Z2 Aerobic', min: 124, max: 143, color: 'var(--hr-2)' },
  { name: 'Z3 Tempo', min: 143, max: 162, color: 'var(--hr-3)' },
  { name: 'Z4 Threshold', min: 162, max: 181, color: 'var(--hr-4)' },
  { name: 'Z5 VO₂max', min: 181, max: Infinity, color: 'var(--hr-5)' },
] as const

function zoneFor(hr: number) {
  return ZONES.find((z) => hr >= z.min && hr < z.max) ?? ZONES[4]
}

function rangeLabel(zone: (typeof ZONES)[number]) {
  return zone.max === Infinity ? `${zone.min}+ bpm` : `${zone.min}–${zone.max} bpm`
}

// ── Component ────────────────────────────────────────────────────

export default function HeartRate({ runs, unit }: Props) {
  const unitLabel = unit === 'mi' ? '/mi' : '/km'

  const withHr = useMemo(
    () => runs.filter((r) => r.avgHr !== null),
    [runs],
  )

  // ── Best pace per zone ─────────────────────────────────────────

  const zoneData = useMemo(() => {
    return ZONES.map((zone) => {
      const inZone = withHr.filter(
        (r) => r.avgHr! >= zone.min && r.avgHr! < zone.max,
      )
      if (inZone.length === 0) return { ...zone, bestRun: null, count: 0, avgPace: 0 }

      const bestRun = inZone.reduce((best, r) =>
        r.avgSpeed > best.avgSpeed ? r : best,
      )
      const avgPace = avg(inZone.map((r) => paceForUnit(r.avgSpeed, unit)))

      return { ...zone, bestRun, count: inZone.length, avgPace }
    })
  }, [withHr, unit])

  const activeZones = useMemo(() => zoneData.filter((z) => z.count > 0), [zoneData])

  // ── KPIs ───────────────────────────────────────────────────────

  const avgHr = useMemo(() => {
    return withHr.length ? Math.round(avg(withHr.map((r) => r.avgHr!))) : 0
  }, [withHr])

  const maxHrData = useMemo(() => {
    let best = 0
    let activityName = ''
    for (const r of runs) {
      if (r.maxHr !== null && r.maxHr > best) {
        best = r.maxHr
        activityName = r.name
      }
    }
    return { value: best, activity: activityName }
  }, [runs])

  const z2Share = useMemo(() => {
    if (!withHr.length) return 0
    const inZ2 = withHr.filter((r) => r.avgHr! >= 124 && r.avgHr! < 143)
    return Math.round((inZ2.length / withHr.length) * 100)
  }, [withHr])

  // ── Zone time distribution (all time) ──────────────────────────

  const zoneDistribution = useMemo(() => {
    const totals = ZONES.map(() => 0)
    let totalTime = 0
    for (const r of runs) {
      if (r.avgHr === null) continue
      const zone = zoneFor(r.avgHr)
      const idx = ZONES.indexOf(zone)
      totals[idx] += r.movingTime
      totalTime += r.movingTime
    }
    return ZONES.map((z, i) => ({
      ...z,
      seconds: totals[i],
      pct: totalTime > 0 ? (totals[i] / totalTime) * 100 : 0,
    }))
  }, [runs])

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard
          label="Avg HR"
          value={avgHr || '—'}
          unit="bpm"
          detail={`${withHr.length} runs with HR data`}
        />
        <KpiCard
          label="Max HR seen"
          value={maxHrData.value || '—'}
          unit="bpm"
          detail={maxHrData.activity || 'No data'}
        />
        <KpiCard
          label="Z2 share"
          value={z2Share}
          unit="%"
          detail="Runs with avg HR 124–143"
          accent={z2Share >= 60 ? 'positive' : undefined}
        />
        <KpiCard
          label="Zones hit"
          value={activeZones.length}
          unit={`/ ${ZONES.length}`}
          detail="Zones with data"
        />
      </div>

      {/* Best pace per zone — only zones with data */}
      <div className={`grid grid-cols-1 gap-2.5 ${
        activeZones.length === 1
          ? 'sm:grid-cols-1'
          : activeZones.length === 2
            ? 'sm:grid-cols-2'
            : activeZones.length === 3
              ? 'sm:grid-cols-3'
              : activeZones.length === 4
                ? 'sm:grid-cols-2 lg:grid-cols-4'
                : 'sm:grid-cols-5'
      }`}>
        {activeZones.map((zone) => (
          <Card
            key={zone.name}
            className="p-4.5 relative overflow-hidden"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-(--radius-m)"
              style={{ backgroundColor: zone.color }}
            />

            <div className="font-mono text-[11px] uppercase tracking-widest text-(--ink-3) mt-1">
              {zone.name}
            </div>
            <div className="font-mono text-[10px] text-(--ink-4) mt-0.5">
              {rangeLabel(zone)}
            </div>

            <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-3 text-(--ink)">
              {zone.bestRun
                ? formatPace(paceForUnit(zone.bestRun.avgSpeed, unit))
                : '—'}
              {zone.bestRun && (
                <span className="text-sm text-(--ink-3) ml-0.5 font-normal">
                  {unitLabel}
                </span>
              )}
            </div>

            <div className="font-mono text-[11px] text-(--ink-3) mt-1.5 truncate">
              {zone.bestRun?.name ?? 'No runs'}
            </div>

            <div className="flex justify-between font-mono text-[10px] text-(--ink-4) mt-3 pt-2.5 border-t border-(--line-2)">
              <span>{zone.count} run{zone.count !== 1 ? 's' : ''}</span>
              {zone.avgPace > 0 && (
                <span>avg {formatPace(zone.avgPace)}</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Zone time distribution — bar chart matching CadenceTab pattern */}
      <Card className="p-4">
        <SectionHeader title="Time in zones" subtitle="All time" />
        <div className="mt-4 flex flex-col gap-2">
          {zoneDistribution.map((zone) => (
            <ZoneBar
              key={zone.name}
              label={zone.name}
              color={zone.color}
              pct={zone.pct}
              active={zone.pct > 0}
              rightLabel={`${zone.pct.toFixed(1)}%`}
              labelWidth="w-34"
              rightWidth="w-14"
            />
          ))}
        </div>
      </Card>

      {/* Best pace per zone table — only zones with data */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-(--line)">
          <SectionHeader title="Best pace per zone" subtitle={`${activeZones.length} zones with data`} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                {['Zone', 'HR range', 'Best pace', 'Avg pace', 'Best run', 'Date', 'Runs'].map((h, i) => (
                  <Th key={h} className={`px-3 ${i === 6 ? 'text-right' : 'text-left'}`}>
                    {h}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeZones.map((zone) => (
                <tr key={zone.name}>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm font-medium text-(--ink)">
                    <span className="flex items-center gap-2">
                      <ColorDot color={zone.color} className="inline-block" />
                      {zone.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3)">
                    {rangeLabel(zone)}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums">
                    {zone.bestRun ? (
                      <span className="text-(--accent) font-medium">
                        {formatPace(paceForUnit(zone.bestRun.avgSpeed, unit))}
                        <span className="text-(--ink-3) font-normal ml-0.5">{unitLabel}</span>
                      </span>
                    ) : (
                      <span className="text-(--ink-4)">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3)">
                    {zone.avgPace > 0 ? `${formatPace(zone.avgPace)}${unitLabel}` : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm text-(--ink-3)">
                    {zone.bestRun?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3)">
                    {zone.bestRun
                      ? new Date(zone.bestRun.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-sm font-mono tabular-nums text-(--ink-3) text-right">
                    {zone.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

