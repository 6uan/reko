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
import { paceForUnit, avg, paceUnit, type Activity, type Unit } from '@/lib/activities'
import { formatDate, getMonday } from '@/lib/dates'
import KpiCard from '@/features/dashboard/ui/KpiCard'
import {
  createColumnHelper,
  useReactTable,
  getCoreRowModel,
} from '@tanstack/react-table'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import EmptyState from '@/features/dashboard/ui/EmptyState'
import Card from '@/features/dashboard/ui/Card'
import ChartContainer from '@/features/dashboard/ui/ChartContainer'
import ChartTooltip from '@/features/dashboard/ui/ChartTooltip'
import Table from '@/features/dashboard/ui/Table'
import ActivityLink from '@/features/dashboard/ui/ActivityLink'
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
  const unitLabel = paceUnit(unit)

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

  const { trendData, trendDelta } = useMemo(() => {
    const buckets = new Map<string, number[]>()
    for (const r of withCadence) {
      const key = getMonday(new Date(r.date)).toISOString().slice(0, 10)
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(r.cadence!)
    }

    const sorted = [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, vals]) => ({
        week: new Date(week).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' }),
        avg: Math.round(avg(vals)),
        runs: vals.length,
      }))

    let delta = 0
    if (sorted.length >= 2) {
      const firstWeeks = sorted.slice(0, Math.ceil(sorted.length / 2))
      const lastWeeks = sorted.slice(Math.ceil(sorted.length / 2))
      delta = Math.round(avg(lastWeeks.map((w) => w.avg)) - avg(firstWeeks.map((w) => w.avg)))
    }

    return { trendData: sorted, trendDelta: delta }
  }, [withCadence])

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

  const cadenceColumns = useMemo(() => [
    cadCol.accessor('name', {
      id: 'name',
      header: 'Activity',
      cell: (info) => (
        <ActivityLink activityId={info.row.original.id} className="truncate max-w-50 inline-block">
          {info.getValue()}
        </ActivityLink>
      ),
    }),
    cadCol.accessor('cadence', {
      id: 'cadence',
      header: 'Cadence',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink)">
          {info.getValue()}<span className="text-(--ink-3) ml-0.5">spm</span>
        </span>
      ),
    }),
    cadCol.accessor((r) => paceForUnit(r.avgSpeed, unit), {
      id: 'pace',
      header: 'Pace',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3)">
          {formatPace(info.getValue())}{unitLabel}
        </span>
      ),
    }),
    cadCol.accessor('date', {
      id: 'date',
      header: 'Date',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3)">
          {formatDate(info.getValue())}
        </span>
      ),
    }),
  ], [unit, unitLabel])

  const cadenceTable = useReactTable({
    data: recentRuns,
    columns: cadenceColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
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
              : `${trendDelta >= 0 ? '+' : ''}${trendDelta}`
          }
          unit="spm"
          detail={
            trendDelta > 0
              ? 'Trending up'
              : trendDelta < 0
                ? 'Trending down'
                : 'Holding steady'
          }
          accent={trendDelta > 0 ? 'positive' : trendDelta < 0 ? 'negative' : undefined}
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
                  dataKey="week"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: 'var(--ink-4)' }}
                />
                <YAxis
                  domain={['dataMin - 3', 'dataMax + 3']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  width={42}
                />
                <Tooltip content={<TrendTooltip />} cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }} />
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
                <Tooltip content={<ScatterTooltip unitLabel={unitLabel} />} cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }} />
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


function TrendTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { week: string; avg: number; runs: number } }>
}) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <ChartTooltip>
      <p className="font-medium text-(--ink) mb-1">Week of {d.week}</p>
      <div className="space-y-0.5 text-(--ink-2)">
        <p>
          Avg{' '}
          <span className="text-(--ink) font-mono tabular-nums font-medium">{d.avg}</span> spm
        </p>
        <p>
          {d.runs} run{d.runs !== 1 ? 's' : ''}
        </p>
      </div>
    </ChartTooltip>
  )
}

function ScatterTooltip({
  active,
  payload,
  unitLabel,
}: {
  active?: boolean
  payload?: Array<{ payload: { name: string; cadence: number; pace: number } }>
  unitLabel: string
}) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <ChartTooltip>
      <p className="font-medium text-(--ink) mb-1">{d.name}</p>
      <div className="space-y-0.5 text-(--ink-2)">
        <p>
          Cadence{' '}
          <span className="text-(--ink) font-mono tabular-nums font-medium">{d.cadence}</span> spm
        </p>
        <p>
          Pace{' '}
          <span className="text-(--ink) font-mono tabular-nums font-medium">{formatPace(d.pace)}</span>
          {unitLabel}
        </p>
      </div>
    </ChartTooltip>
  )
}
