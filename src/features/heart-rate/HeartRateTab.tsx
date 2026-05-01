import { useMemo } from 'react'
import { formatPace } from '../../lib/strava'
import { paceForUnit, avg, type Activity, type Unit } from '../../lib/activities'

type Props = { runs: Activity[]; unit: Unit }

// ── Zone definitions ──────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────

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

  // ── KPIs ───────────────────────────────────────────────────────

  const avgHr30 = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const recent = withHr.filter((r) => new Date(r.date) >= cutoff)
    const hrs = recent.map((r) => r.avgHr!)
    return Math.round(avg(hrs))
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

  const zonesHit = zoneData.filter((z) => z.bestRun !== null).length

  // ── Zone time distribution (30d) ───────────────────────────────

  const zoneDistribution = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const recent = runs.filter((r) => new Date(r.date) >= cutoff)

    const totals = ZONES.map(() => 0)
    let totalTime = 0
    for (const r of recent) {
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
        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Avg HR · 30d
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {avgHr30 || '—'}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">bpm</span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            {withHr.length} runs with HR data
          </div>
        </div>

        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Max HR seen
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {maxHrData.value || '—'}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">bpm</span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            {maxHrData.activity || 'No data'}
          </div>
        </div>

        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Z2 share
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {z2Share}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">%</span>
          </div>
          <div className={`font-mono text-[11px] mt-1.5 ${z2Share >= 60 ? 'text-(--ok)' : 'text-(--ink-3)'}`}>
            Runs with avg HR 124–143
          </div>
        </div>

        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Zones hit
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {zonesHit}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">/ {ZONES.length}</span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            Zones with data
          </div>
        </div>
      </div>

      {/* Best pace per zone — main feature */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
        {zoneData.map((zone) => (
          <div
            key={zone.name}
            className="bg-(--card) border border-(--line) rounded-[14px] p-4.5 relative overflow-hidden"
          >
            {/* Zone color bar */}
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-[14px]"
              style={{ backgroundColor: zone.color }}
            />

            <div className="font-mono text-[11px] uppercase tracking-widest text-(--ink-3) mt-1">
              {zone.name}
            </div>
            <div className="font-mono text-[10px] text-(--ink-4) mt-0.5">
              {zone.max === Infinity ? `${zone.min}+ bpm` : `${zone.min}–${zone.max} bpm`}
            </div>

            <div className="font-mono text-[28px] font-medium tracking-tight tabular-nums mt-3 text-(--ink)">
              {zone.bestRun
                ? formatPace(paceForUnit(zone.bestRun.avgSpeed, unit))
                : '—'}
              {zone.bestRun && (
                <span className="text-[12px] text-(--ink-3) ml-0.5 font-normal">
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
          </div>
        ))}
      </div>

      {/* Zone time distribution */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4.5">
        <div className="flex justify-between items-baseline mb-4">
          <h3 className="text-[15px] font-medium">Time in zones · last 30 days</h3>
          <span className="font-mono text-[11px] text-(--ink-3)">
            {withHr.length} runs
          </span>
        </div>
        <div className="space-y-3">
          {zoneDistribution.map((zone) => (
            <div key={zone.name} className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 1fr 60px' }}>
              <span className="font-mono text-[11px] text-(--ink-3) truncate">
                {zone.name}
              </span>
              <div className="h-2.5 rounded-full bg-(--line-2) overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${zone.pct}%`,
                    backgroundColor: zone.color,
                  }}
                />
              </div>
              <span className="font-mono text-[11px] text-(--ink-3) text-right tabular-nums">
                {zone.pct.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* All runs by zone table */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-(--line)">
          <h3 className="text-[15px] font-medium text-(--ink)">
            Best pace per zone breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-160">
            <thead>
              <tr>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Zone
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  HR range
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Best pace
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Avg pace
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Best run
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Date
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-right font-medium">
                  Runs
                </th>
              </tr>
            </thead>
            <tbody>
              {zoneData.map((zone) => (
                <tr key={zone.name}>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-medium text-(--ink)">
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: zone.color }}
                      />
                      {zone.name}
                    </span>
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3)">
                    {zone.max === Infinity ? `${zone.min}+` : `${zone.min}–${zone.max}`} bpm
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums">
                    {zone.bestRun ? (
                      <span className="text-(--accent) font-medium">
                        {formatPace(paceForUnit(zone.bestRun.avgSpeed, unit))}
                        <span className="text-(--ink-3) font-normal ml-0.5">{unitLabel}</span>
                      </span>
                    ) : (
                      <span className="text-(--ink-4)">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3)">
                    {zone.avgPace > 0
                      ? `${formatPace(zone.avgPace)}${unitLabel}`
                      : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] text-(--ink-3)">
                    {zone.bestRun?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3)">
                    {zone.bestRun
                      ? new Date(zone.bestRun.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3) text-right">
                    {zone.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
