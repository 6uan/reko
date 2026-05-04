import { useMemo } from 'react'
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { formatPace } from '@/lib/strava'
import { paceForUnit, avg, type Activity, type Unit } from '@/lib/activities'
import { groupByWeek, trendDelta } from '@/lib/aggregations'
import KpiCard from '@/features/dashboard/ui/KpiCard'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from '@tanstack/react-table'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import EmptyState from '@/features/dashboard/ui/EmptyState'
import Card from '@/features/dashboard/ui/Card'
import ChartContainer from '@/features/dashboard/ui/ChartContainer'
import { makeTooltip } from '@/features/dashboard/ui/ChartTooltip'
import Table from '@/features/dashboard/ui/Table'
import { nameColumn, paceColumn, dateColumn } from '@/features/dashboard/ui/columns'
import ZoneBar from '@/features/dashboard/ui/ZoneBar'

type Props = { runs: Activity[]; unit: Unit }

// ── Helpers ──────────────────────────────────────────────────────

function linearRegression(pts: { x: number; y: number }[]) {
  const n = pts.length
  if (n < 2) return { slope: 0, intercept: 0 }
  const sx = pts.reduce((a, p) => a + p.x, 0)
  const sy = pts.reduce((a, p) => a + p.y, 0)
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0)
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n }
  return {
    slope: (n * sxy - sx * sy) / denom,
    intercept: (sy - ((n * sxy - sx * sy) / denom) * sx) / n,
  }
}

/** Garmin-style cadence zones based on runner percentiles. */
const CADENCE_ZONES = [
  { label: '185+', min: 185, max: Infinity, color: 'var(--hr-1)' },
  { label: '174–185', min: 174, max: 185, color: 'var(--hr-2)' },
  { label: '163–173', min: 163, max: 174, color: 'var(--hr-3)' },
  { label: '151–162', min: 151, max: 163, color: 'var(--hr-4)' },
  { label: '<151', min: 0, max: 151, color: 'var(--hr-5)' },
]

// ── Component ────────────────────────────────────────────────────

export default function CadenceTab({ runs, unit }: Props) {

  const withCadence = useMemo(
    () => runs.filter((r) => r.cadence != null && r.cadence > 0),
    [runs],
  )

  // ── KPIs ─────────────────────────────────────────────────────

  const avgCadence = useMemo(() => {
    if (!withCadence.length) return 0
    return Math.round(avg(withCadence.map((r) => r.cadence!)))
  }, [withCadence])

  const highestRun = useMemo(() => {
    if (!withCadence.length) return null
    return withCadence.reduce((best, r) => (r.cadence! > best.cadence! ? r : best))
  }, [withCadence])

  // ── Weekly trend (all time) ────────────────────────────────────

  const trendData = useMemo(
    () => groupByWeek(withCadence, (r) => r.date, (r) => r.cadence),
    [withCadence],
  )

  const cadenceDelta = useMemo(() => trendDelta(trendData), [trendData])

  // ── Scatter data ─────────────────────────────────────────────

  const scatterData = useMemo(
    () =>
      withCadence.map((r) => ({
        cadence: r.cadence!,
        pace: paceForUnit(r.avgSpeed, unit),
        name: r.name,
      })),
    [withCadence, unit],
  )

  const regressionLine = useMemo(() => {
    if (scatterData.length < 2) return null
    const reg = linearRegression(scatterData.map((d) => ({ x: d.pace, y: d.cadence })))
    const paces = scatterData.map((d) => d.pace)
    const minP = Math.min(...paces)
    const maxP = Math.max(...paces)
    return [
      { pace: minP, cadence: reg.slope * minP + reg.intercept },
      { pace: maxP, cadence: reg.slope * maxP + reg.intercept },
    ]
  }, [scatterData])

  // ── Distribution ─────────────────────────────────────────────

  const distribution = useMemo(() => {
    const total = withCadence.length || 1
    return CADENCE_ZONES.map((zone) => {
      const count = withCadence.filter(
        (r) => r.cadence! >= zone.min && r.cadence! < zone.max,
      ).length
      return { ...zone, count, pct: Math.round((count / total) * 100) }
    })
  }, [withCadence])

  // ── Recent runs ──────────────────────────────────────────────

  const recentRuns = useMemo(
    () => [...withCadence].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20),
    [withCadence],
  )

  const cadCol = createColumnHelper<Activity>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cadenceColumns = useMemo((): ColumnDef<any, any>[] => [
    nameColumn(),
    cadCol.accessor('cadence', {
      id: 'cadence',
      header: 'Cadence',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink)">
          {info.getValue()}<span className="text-(--ink-3) ml-0.5">spm</span>
        </span>
      ),
    }),
    paceColumn(unit),
    dateColumn(),
  ], [unit])

  const cadenceTable = useReactTable({
    data: recentRuns,
    columns: cadenceColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
        <KpiCard
          label="Average cadence"
          value={avgCadence > 0 ? String(avgCadence) : '—'}
          unit="spm"
          detail={`${withCadence.length} runs with cadence`}
        />
        <KpiCard
          label="Highest cadence"
          value={highestRun ? String(highestRun.cadence) : '—'}
          unit="spm"
          detail={highestRun?.name ?? 'No data'}
        />
        <KpiCard
          label="Trend"
          value={
            trendData.length < 2
              ? '—'
              : `${cadenceDelta >= 0 ? '+' : ''}${cadenceDelta}`
          }
          unit="spm"
          detail={
            cadenceDelta > 0
              ? 'Trending up'
              : cadenceDelta < 0
                ? 'Trending down'
                : 'Holding steady'
          }
          accent={cadenceDelta > 0 ? 'positive' : cadenceDelta < 0 ? 'negative' : undefined}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Trend chart */}
        <Card className="p-4">
          <SectionHeader title="Weekly avg cadence" subtitle="All time" />
          {trendData.length > 1 ? (
            <ChartContainer>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                />
                <YAxis
                  domain={['dataMin - 3', 'dataMax + 3']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  width={42}
                />
                <Tooltip content={<CadenceTrendTooltip />} cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }} />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--card)' }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <EmptyState>Not enough data yet</EmptyState>
          )}
        </Card>

        {/* Scatter: cadence vs pace */}
        <Card className="p-4">
          <SectionHeader title="Cadence vs pace" subtitle="Each dot = one run" />
          {scatterData.length >= 2 ? (
            <ChartContainer>
              <ScatterChart margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="pace"
                  type="number"
                  reversed
                  domain={['dataMin - 10', 'dataMax + 10']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  tickFormatter={(v: number) => formatPace(v)}
                  name="Pace"
                />
                <YAxis
                  dataKey="cadence"
                  type="number"
                  domain={['dataMin - 4', 'dataMax + 4']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  width={42}
                  name="Cadence"
                />
                <Tooltip content={<ScatterTooltip />} cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }} />
                <Scatter data={scatterData} fill="var(--accent)" opacity={0.7} r={4} />
                {regressionLine && (
                  <ReferenceLine
                    segment={[
                      { x: regressionLine[0].pace, y: regressionLine[0].cadence },
                      { x: regressionLine[1].pace, y: regressionLine[1].cadence },
                    ] as const}
                    stroke="var(--ink-4)"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                  />
                )}
              </ScatterChart>
            </ChartContainer>
          ) : (
            <EmptyState>Not enough data yet</EmptyState>
          )}
        </Card>
      </div>

      {/* Distribution — Garmin-style zones */}
      <Card className="p-4">
        <SectionHeader title="Cadence zones" subtitle="Garmin percentile ranges" />
        <div className="mt-4 flex flex-col gap-2">
          {distribution.map((zone) => (
            <ZoneBar
              key={zone.label}
              label={zone.label}
              color={zone.color}
              pct={zone.pct}
              active={zone.count > 0}
              rightLabel={`${zone.count} run${zone.count !== 1 ? 's' : ''}`}
              labelWidth="w-24"
              rightWidth="w-16"
            />
          ))}
        </div>
      </Card>

      {/* Recent runs */}
      <Table
        table={cadenceTable}
        title="Recent runs"
        subtitle="Latest 20 with cadence data"
        emptyMessage="No runs with cadence data"
      />
    </div>
  )
}


const CadenceTrendTooltip = makeTooltip<{ label: string; avg: number; count: number }>((d) => (
  <>
    <p className="font-medium text-(--ink) mb-1">Week of {d.label}</p>
    <div className="space-y-0.5 text-(--ink-2)">
      <p>
        Avg{' '}
        <span className="text-(--ink) font-mono tabular-nums font-medium">{Math.round(d.avg)}</span> spm
      </p>
      <p>
        {d.count} run{d.count !== 1 ? 's' : ''}
      </p>
    </div>
  </>
))

const ScatterTooltip = makeTooltip<{ name: string; cadence: number; pace: number }>((d) => (
  <>
    <p className="font-medium text-(--ink) mb-1">{d.name}</p>
    <div className="space-y-0.5 text-(--ink-2)">
      <p>
        Cadence{' '}
        <span className="text-(--ink) font-mono tabular-nums font-medium">{d.cadence}</span> spm
      </p>
      <p>
        Pace{' '}
        <span className="text-(--ink) font-mono tabular-nums font-medium">{formatPace(d.pace)}</span>
      </p>
    </div>
  </>
))
