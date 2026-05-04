import { useMemo } from 'react'
import { formatPace } from '@/lib/strava'
import { paceForUnit, avg, paceUnit, KM_PER_MI, type Activity, type Unit } from '@/lib/activities'
import { formatDate } from '@/lib/dates'
import {
  HR_ZONES,
  rangeLabel,
  zoneFor,
  fallbackWindowsFor,
  formatWindow,
} from '@/lib/heartRate'
import KpiCard from '@/features/dashboard/ui/KpiCard'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import Card from '@/features/dashboard/ui/Card'
import Table from '@/features/dashboard/ui/Table'
import ColorDot from '@/features/dashboard/ui/ColorDot'
import ZoneBar from '@/features/dashboard/ui/ZoneBar'
import ActivityLink from '@/features/dashboard/ui/ActivityLink'

type Props = { runs: Activity[]; unit: Unit }

// ── Component ────────────────────────────────────────────────────

const ZONES = HR_ZONES

export default function HeartRate({ runs, unit }: Props) {
  const unitLabel = paceUnit(unit)

  const withHr = useMemo(
    () => runs.filter((r) => r.avgHr !== null),
    [runs],
  )

  // ── Per-zone summary: avg pace across runs whose AVG HR was in zone,
  //    plus the global best sustained pace + activity. Each zone tries
  //    its canonical sustained window first (e.g. 5m for Z4), falling
  //    back to shorter windows when no run has data at the canonical.
  const zoneData = useMemo(() => {
    return ZONES.map((zone) => {
      const inZone = withHr.filter(
        (r) => r.avgHr! >= zone.min && r.avgHr! < zone.max,
      )
      const count = inZone.length
      const avgPace =
        count > 0 ? avg(inZone.map((r) => paceForUnit(r.avgSpeed, unit))) : 0

      // Try windows from longest to shortest; show the longest with data.
      let best: {
        activity: Activity
        pace: number
        windowSec: number
      } | null = null
      for (const w of fallbackWindowsFor(zone.name)) {
        let bestAtWindow: { activity: Activity; pace: number } | null = null
        for (const r of runs) {
          const secPerKm = r.hrZoneEfforts[zone.name]?.[w]
          if (secPerKm === undefined) continue
          const pace =
            unit === 'mi' ? secPerKm * (KM_PER_MI / 1000) : secPerKm
          if (bestAtWindow === null || pace < bestAtWindow.pace) {
            bestAtWindow = { activity: r, pace }
          }
        }
        if (bestAtWindow !== null) {
          best = { ...bestAtWindow, windowSec: w }
          break
        }
      }

      return { ...zone, count, avgPace, best }
    })
  }, [withHr, runs, unit])

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

  type ZoneRow = (typeof activeZones)[number]
  const zoneCol = createColumnHelper<ZoneRow>()

  const zoneColumns = useMemo(() => [
    zoneCol.accessor('name', {
      id: 'zone',
      header: 'Zone',
      cell: (info) => (
        <span className="flex items-center gap-2 font-medium text-(--ink)">
          <ColorDot color={info.row.original.color} className="inline-block" />
          {info.getValue()}
        </span>
      ),
    }),
    zoneCol.display({
      id: 'hrRange',
      header: 'HR range',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3)">{rangeLabel(info.row.original)}</span>
      ),
    }),
    zoneCol.display({
      id: 'bestPace',
      header: 'Best pace',
      cell: (info) => {
        const zone = info.row.original
        return zone.best ? (
          <span className="font-mono tabular-nums text-(--accent) font-medium">
            {formatPace(zone.best.pace)}
            <span className="text-(--ink-3) font-normal ml-0.5">{unitLabel}</span>
            <span className="text-(--ink-4) font-normal ml-1.5 text-xs">
              {formatWindow(zone.best.windowSec)}
            </span>
          </span>
        ) : (
          <span className="text-(--ink-4)">—</span>
        )
      },
    }),
    zoneCol.accessor('avgPace', {
      id: 'avgPace',
      header: 'Avg pace',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3)">
          {info.getValue() > 0 ? `${formatPace(info.getValue())}${unitLabel}` : '—'}
        </span>
      ),
    }),
    zoneCol.display({
      id: 'bestRun',
      header: 'Best run',
      cell: (info) => {
        const zone = info.row.original
        return zone.best ? (
          <ActivityLink activityId={zone.best.activity.id} className="text-(--ink-2) no-underline">
            {zone.best.activity.name}
          </ActivityLink>
        ) : (
          <span className="text-(--ink-3)">—</span>
        )
      },
    }),
    zoneCol.display({
      id: 'date',
      header: 'Date',
      cell: (info) => {
        const zone = info.row.original
        return (
          <span className="font-mono tabular-nums text-(--ink-3)">
            {zone.best ? formatDate(zone.best.activity.date) : '—'}
          </span>
        )
      },
    }),
    zoneCol.accessor('count', {
      id: 'runs',
      header: 'Runs',
      meta: { align: 'right' },
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3)">{info.getValue()}</span>
      ),
    }),
  ], [unitLabel])

  const zoneTable = useReactTable({
    data: activeZones,
    columns: zoneColumns,
    getCoreRowModel: getCoreRowModel(),
  })

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
            className="p-4 relative overflow-hidden"
          >
            <div
              className="absolute top-0 left-0 right-0 h-1 rounded-t-(--radius-m)"
              style={{ backgroundColor: zone.color }}
            />

            <div className="font-mono text-[11px] uppercase tracking-widest text-(--ink-3) mt-1">
              {zone.name}
            </div>
            <div className="text-meta mt-0.5">
              {rangeLabel(zone)}
            </div>

            <div className="text-stat text-(--ink) mt-3">
              {zone.avgPace > 0 ? formatPace(zone.avgPace) : '—'}
              {zone.avgPace > 0 && (
                <span className="text-sm text-(--ink-3) ml-0.5 font-normal">
                  {unitLabel}
                </span>
              )}
            </div>

            <div className="flex justify-between items-baseline text-meta mt-3 pt-2.5 border-t border-(--line-2)">
              <span>{zone.count} run{zone.count !== 1 ? 's' : ''}</span>
              {zone.best && (
                <ActivityLink
                  activityId={zone.best.activity.id}
                  className="text-(--ink-3)"
                >
                  {formatWindow(zone.best.windowSec)} best{' '}
                  {formatPace(zone.best.pace)}
                </ActivityLink>
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
      <Table
        table={zoneTable}
        title="Best pace per zone"
        subtitle={`${activeZones.length} zones with data`}
      />
    </div>
  )
}

