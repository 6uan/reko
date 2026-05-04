import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { formatPace, formatDuration } from '@/lib/strava'
import { formatDate, getMonday } from '@/lib/dates'
import {
  KM_PER_MI,
  toDisplayDistance,
  avg,
  paceUnit,
  type Activity,
  type Unit,
} from '@/lib/activities'
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

type Props = { runs: Activity[]; unit: Unit }

// ── Helpers ───────────────────────────────────────────────────────

function distInUnit(meters: number, unit: Unit) {
  return unit === 'mi' ? meters / KM_PER_MI : meters / 1000
}

/** Pace from distance + moving time. */
function paceForRun(run: Activity, unit: Unit) {
  const d = distInUnit(run.distanceMeters, unit)
  return d > 0 ? run.movingTime / d : 0
}

// ── Component ─────────────────────────────────────────────────────

export default function Pace({ runs, unit }: Props) {
  const unitLabel = paceUnit(unit)

  // ── KPI calculations ────────────────────────────────────────────

  const paces = useMemo(() => runs.map((r) => paceForRun(r, unit)), [runs, unit])

  const currentAvgPace = useMemo(() => {
    const valid = paces.filter((p) => p > 0)
    return avg(valid)
  }, [paces])

  const fastestPace = useMemo(() => {
    const valid = paces.filter((p) => p > 0)
    return valid.length ? Math.min(...valid) : 0
  }, [paces])

  const easyAvg = useMemo(() => {
    const easy = runs
      .filter((r) => r.avgHr !== null && r.avgHr < 150)
      .map((r) => paceForRun(r, unit))
      .filter((p) => p > 0)
    return avg(easy)
  }, [runs, unit])

  const tempoAvg = useMemo(() => {
    const tempo = runs
      .filter((r) => r.avgHr !== null && r.avgHr >= 155)
      .map((r) => paceForRun(r, unit))
      .filter((p) => p > 0)
    return avg(tempo)
  }, [runs, unit])

  // ── Histogram bins ──────────────────────────────────────────────

  type HistBin = { label: string; count: number; isTallest: boolean }

  const histogramData = useMemo<HistBin[]>(() => {
    const valid = paces.filter((p) => p > 0)
    if (!valid.length) return []
    const min = Math.min(...valid)
    const max = Math.max(...valid)
    const binCount = 10
    const binSize = (max - min) / binCount || 1
    const bins = Array(binCount).fill(0) as number[]
    valid.forEach((p) => {
      const idx = Math.min(Math.floor((p - min) / binSize), binCount - 1)
      bins[idx]++
    })
    const maxCount = Math.max(...bins)
    return bins.map((count, i) => ({
      label: formatPace(min + i * binSize),
      count,
      isTallest: count === maxCount && count > 0,
    }))
  }, [paces])

  // ── Weekly trend (all time) ─────────────────────────────────────

  type TrendPoint = { week: string; label: string; avg: number; runs: number }

  const trendData = useMemo<TrendPoint[]>(() => {
    const buckets = new Map<string, number[]>()
    runs.forEach((r) => {
      const mon = getMonday(new Date(r.date))
      const key = mon.toISOString().slice(0, 10)
      const p = paceForRun(r, unit)
      if (p > 0) {
        if (!buckets.has(key)) buckets.set(key, [])
        buckets.get(key)!.push(p)
      }
    })

    return [...buckets.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, vals]) => {
        const d = new Date(week)
        return {
          week,
          label: `${d.getMonth() + 1}/${d.getDate()}`,
          avg: avg(vals),
          runs: vals.length,
        }
      })
  }, [runs, unit])

  // ── Fastest runs (sorted by pace, ascending) ───────────────────

  const fastestRuns = useMemo(() => {
    return [...runs]
      .filter((r) => r.avgSpeed > 0)
      .sort((a, b) => b.avgSpeed - a.avgSpeed)
      .slice(0, 20)
  }, [runs])

  const paceCol = createColumnHelper<Activity>()

  const paceColumns = useMemo(() => [
    paceCol.display({
      id: 'rank',
      header: '#',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3)">{info.row.index + 1}</span>
      ),
    }),
    paceCol.accessor('name', {
      id: 'name',
      header: 'Activity',
      cell: (info) => (
        <ActivityLink activityId={info.row.original.id} className="truncate max-w-50 inline-block">
          {info.getValue()}
        </ActivityLink>
      ),
    }),
    paceCol.accessor((r) => paceForRun(r, unit), {
      id: 'pace',
      header: 'Pace',
      cell: (info) => (
        <span className="font-mono tabular-nums whitespace-nowrap">
          <span className={info.row.index === 0 ? 'text-(--accent) font-medium' : 'text-(--ink)'}>
            {formatPace(info.getValue())}
          </span>
          <span className="text-(--ink-3) text-xs ml-0.5">{unitLabel}</span>
        </span>
      ),
    }),
    paceCol.accessor('distanceMeters', {
      id: 'distance',
      header: 'Distance',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
          {toDisplayDistance(info.getValue(), unit)} {unit}
        </span>
      ),
    }),
    paceCol.accessor('movingTime', {
      id: 'time',
      header: 'Time',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
          {formatDuration(info.getValue())}
        </span>
      ),
    }),
    paceCol.accessor('avgHr', {
      id: 'avgHr',
      header: 'Avg HR',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
          {info.getValue() !== null ? `${Math.round(info.getValue()!)} bpm` : '—'}
        </span>
      ),
    }),
    paceCol.accessor('date', {
      id: 'date',
      header: 'Date',
      cell: (info) => (
        <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
          {formatDate(info.getValue())}
        </span>
      ),
    }),
  ], [unit, unitLabel])

  const paceTable = useReactTable({
    data: fastestRuns,
    columns: paceColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  // ── Trend Y-axis domain ─────────────────────────────────────────

  const trendDomain = useMemo(() => {
    if (trendData.length <= 1) return [0, 1]
    const vals = trendData.map((d) => d.avg)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const pad = (max - min) * 0.15 || 10
    return [min - pad, max + pad]
  }, [trendData])

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <KpiCard label="Avg pace" value={formatPace(currentAvgPace)} unit={unitLabel} detail={`${runs.length} runs`} />
        <KpiCard label="Fastest ever" value={formatPace(fastestPace)} unit={unitLabel} detail="All-time best" />
        <KpiCard label="Easy avg" value={formatPace(easyAvg)} unit={unitLabel} detail="Avg HR < 150 bpm" />
        <KpiCard label="Tempo avg" value={formatPace(tempoAvg)} unit={unitLabel} detail="Avg HR ≥ 155 bpm" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Histogram */}
        <Card className="p-4">
          <SectionHeader title="Pace distribution" subtitle={`${runs.length} runs`} />
          {histogramData.length > 0 ? (
            <ChartContainer>
              <BarChart data={histogramData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  interval={1}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  allowDecimals={false}
                />
                <Tooltip content={<HistTooltip />} cursor={{ fill: 'var(--line)', opacity: 0.5 }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="var(--accent)" opacity={0.7} />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState>No pace data yet</EmptyState>
          )}
        </Card>

        {/* Trend line */}
        <Card className="p-4">
          <SectionHeader title="Avg pace trend" subtitle={`${trendData.length} weeks`} />
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
                  domain={trendDomain}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: 'var(--ink-4)' }}
                  tickFormatter={(v: number) => formatPace(v)}
                  width={50}
                />
                <Tooltip content={<TrendTooltip unitLabel={unitLabel} />} cursor={{ stroke: 'var(--line)', strokeDasharray: '4 4' }} />
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
      </div>

      {/* Fastest runs table */}
      <Table
        table={paceTable}
        title="Fastest runs"
        subtitle="Sorted by pace, fastest first"
        emptyMessage="No pace data yet"
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function HistTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: { label: string; count: number } }>
}) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <ChartTooltip>
      <p className="font-medium text-(--ink) mb-1">~{d.label}</p>
      <p className="text-(--ink-2)">
        {d.count} run{d.count !== 1 ? 's' : ''}
      </p>
    </ChartTooltip>
  )
}

function TrendTooltip({
  active,
  payload,
  unitLabel,
}: {
  active?: boolean
  payload?: Array<{ payload: { week: string; avg: number; runs: number } }>
  unitLabel: string
}) {
  if (!active || !payload?.[0]) return null
  const d = payload[0].payload
  return (
    <ChartTooltip>
      <p className="font-medium text-(--ink) mb-1">Week of {d.week}</p>
      <div className="space-y-0.5 text-(--ink-2)">
        <p>
          Avg{' '}
          <span className="text-(--ink) font-mono tabular-nums font-medium">
            {formatPace(d.avg)}
          </span>{' '}
          {unitLabel}
        </p>
        <p>
          {d.runs} run{d.runs !== 1 ? 's' : ''}
        </p>
      </div>
    </ChartTooltip>
  )
}
