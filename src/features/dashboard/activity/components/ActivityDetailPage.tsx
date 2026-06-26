/**
 * Activity detail page — per-activity overview rendered inside the dashboard
 * shell. Reads native: same UI primitives, design tokens, and km/mi handling
 * as every other tab. All numbers arrive SI from getActivityDetail; this
 * layer formats to the user's unit.
 *
 * Sections render only when their underlying channel exists, so a no-HR walk
 * or a not-yet-detail-synced activity degrades gracefully.
 */

import {
  Area,
  AreaChart,
  Line,
  LineChart,
  ReferenceArea,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  createColumnHelper,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Link } from '@tanstack/react-router'
import { formatDuration, formatPace } from '@/lib/strava'
import {
  distanceUnit,
  KM_PER_MI,
  paceForUnit,
  paceUnit,
  toDisplayDistance,
  type Unit,
} from '@/lib/activities'
import { formatDate } from '@/lib/dates'
import { HR_ZONES } from '@/lib/heartRate'
import Card from '@/features/dashboard/ui/Card'
import KpiCard from '@/features/dashboard/ui/KpiCard'
import SectionHeader from '@/features/dashboard/ui/SectionHeader'
import ChartContainer from '@/features/dashboard/ui/ChartContainer'
import { makeTooltip } from '@/features/dashboard/ui/ChartTooltip'
import EmptyState from '@/features/dashboard/ui/EmptyState'
import ZoneBar from '@/features/dashboard/ui/ZoneBar'
import Table from '@/features/dashboard/ui/Table'
import StravaLink from '@/features/dashboard/ui/StravaLink'
import SyncActivityButton from './SyncActivityButton'
import type {
  ActivityDetailPayload,
  LapRow,
  PaceSplit,
  SplitRow,
} from '@/features/dashboard/activity/api/getActivityDetail.server'

type Props = {
  detail: ActivityDetailPayload
  unit: Unit
}

/** Charting row in DISPLAY units (distance in km/mi, pace in sec/unit). */
type ChartRow = {
  dist: number
  elev?: number
  hr?: number
  pace?: number
  gap?: number
  grade?: number
}

const CHART_MARGIN = { top: 4, right: 8, bottom: 0, left: 0 }
const AXIS_TICK = { fontSize: 10, fill: 'var(--ink-4)' } as const
const CURSOR = { stroke: 'var(--line)', strokeDasharray: '4 4' } as const

function niceDomain(vals: number[], pad: number): [number, number] {
  if (vals.length === 0) return [0, 1]
  return [Math.min(...vals) - pad, Math.max(...vals) + pad]
}

const splitCol = createColumnHelper<SplitRow>()
const paceSplitCol = createColumnHelper<PaceSplit>()
const lapCol = createColumnHelper<LapRow>()

export default function ActivityDetailPage({ detail, unit }: Props) {
  const { activity: a, stats, channels, series } = detail
  const distLabel = distanceUnit(unit)
  const paceLabel = paceUnit(unit)

  // sec/km → sec/display-unit
  const toUnitPace = (secPerKm: number) =>
    unit === 'mi' ? secPerKm * (KM_PER_MI / 1000) : secPerKm

  const chartData: ChartRow[] = series.map((r) => ({
    dist: unit === 'mi' ? r.distM / KM_PER_MI : r.distM / 1000,
    elev: r.elev,
    hr: r.hr,
    pace: r.paceSecPerKm !== undefined ? toUnitPace(r.paceSecPerKm) : undefined,
    gap:
      r.gapPaceSecPerKm !== undefined
        ? toUnitPace(r.gapPaceSecPerKm)
        : undefined,
    grade: r.grade,
  }))

  const maxDist = chartData.length
    ? chartData[chartData.length - 1].dist
    : 0
  const paceVals = chartData
    .map((d) => d.pace)
    .filter((p): p is number => p !== undefined)
  const gapVals = chartData
    .map((d) => d.gap)
    .filter((g): g is number => g !== undefined)
  const hrVals = chartData
    .map((d) => d.hr)
    .filter((h): h is number => h !== undefined)

  const paceDomain = niceDomain([...paceVals, ...gapVals], 10)
  const hrMin = hrVals.length ? Math.max(0, Math.min(...hrVals) - 5) : 0
  const hrMax = hrVals.length ? Math.max(...hrVals) + 5 : 200

  // Splits table — hooks must run unconditionally.
  const splitTable = useReactTable({
    data: detail.splits,
    columns: [
      splitCol.accessor('key', {
        header: 'Distance',
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-2)">
            {i.getValue()}
          </span>
        ),
      }),
      splitCol.accessor('seconds', {
        header: 'Time',
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
            {formatDuration(i.getValue())}
          </span>
        ),
      }),
      splitCol.accessor('derived', {
        header: 'Source',
        cell: (i) => (
          <span className="text-xs text-(--ink-4)">
            {i.getValue() ? 'Derived' : 'Strava'}
          </span>
        ),
      }),
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  // Per-unit splits (km or mi) + laps — hooks must run unconditionally.
  const unitSplits = unit === 'mi' ? detail.splitsStandard : detail.splitsMetric
  const splitsHaveHr = unitSplits.some((s) => s.hr !== null)
  const splitsHaveElev = unitSplits.some((s) => s.elevM !== null)

  const paceSplitTable = useReactTable({
    data: unitSplits,
    columns: [
      paceSplitCol.accessor('index', {
        header: 'Split',
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-2)">
            {i.getValue()}
          </span>
        ),
      }),
      paceSplitCol.accessor('paceSecPerKm', {
        header: 'Pace',
        meta: { align: 'right' },
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink) whitespace-nowrap">
            {formatPace(toUnitPace(i.getValue()))}
          </span>
        ),
      }),
      paceSplitCol.accessor('seconds', {
        header: 'Time',
        meta: { align: 'right' },
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
            {formatDuration(i.getValue())}
          </span>
        ),
      }),
      ...(splitsHaveHr
        ? [
            paceSplitCol.accessor('hr', {
              header: 'HR',
              meta: { align: 'right' },
              cell: (i) => {
                const v = i.getValue()
                return (
                  <span className="font-mono tabular-nums text-(--ink-3)">
                    {v !== null ? Math.round(v) : '—'}
                  </span>
                )
              },
            }),
          ]
        : []),
      ...(splitsHaveElev
        ? [
            paceSplitCol.accessor('elevM', {
              header: 'Elev',
              meta: { align: 'right' },
              cell: (i) => {
                const v = i.getValue()
                return (
                  <span className="font-mono tabular-nums text-(--ink-4) whitespace-nowrap">
                    {v !== null ? `${v > 0 ? '+' : ''}${Math.round(v)} m` : '—'}
                  </span>
                )
              },
            }),
          ]
        : []),
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  const lapsHaveHr = detail.laps.some((l) => l.hr !== null)
  const lapTable = useReactTable({
    data: detail.laps,
    columns: [
      lapCol.accessor('index', {
        header: 'Lap',
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-2)">
            {i.getValue()}
          </span>
        ),
      }),
      lapCol.accessor('distanceM', {
        header: 'Distance',
        meta: { align: 'right' },
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
            {toDisplayDistance(i.getValue(), unit)} {distLabel}
          </span>
        ),
      }),
      lapCol.accessor('seconds', {
        header: 'Time',
        meta: { align: 'right' },
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink-3) whitespace-nowrap">
            {formatDuration(i.getValue())}
          </span>
        ),
      }),
      lapCol.accessor('paceSecPerKm', {
        header: 'Pace',
        meta: { align: 'right' },
        cell: (i) => (
          <span className="font-mono tabular-nums text-(--ink) whitespace-nowrap">
            {formatPace(toUnitPace(i.getValue()))}
          </span>
        ),
      }),
      ...(lapsHaveHr
        ? [
            lapCol.accessor('hr', {
              header: 'HR',
              meta: { align: 'right' },
              cell: (i) => {
                const v = i.getValue()
                return (
                  <span className="font-mono tabular-nums text-(--ink-3)">
                    {v !== null ? Math.round(v) : '—'}
                  </span>
                )
              },
            }),
          ]
        : []),
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  // ── Tooltips (close over unit labels) ──
  const ElevTip = makeTooltip<ChartRow>((d) => (
    <p className="text-(--ink-2)">
      <span className="font-mono tabular-nums">{d.dist.toFixed(2)}</span>{' '}
      {distLabel} ·{' '}
      <span className="font-mono tabular-nums text-(--ink)">
        {Math.round(d.elev ?? 0)} m
      </span>
    </p>
  ))
  const PaceTip = makeTooltip<ChartRow>((d) => (
    <div className="space-y-0.5 text-(--ink-2)">
      <p className="font-medium text-(--ink)">
        {d.dist.toFixed(2)} {distLabel}
      </p>
      {d.pace !== undefined && (
        <p>
          Pace{' '}
          <span className="font-mono tabular-nums text-(--ink)">
            {formatPace(d.pace)}
          </span>{' '}
          {paceLabel}
        </p>
      )}
      {d.gap !== undefined && (
        <p>
          GAP{' '}
          <span className="font-mono tabular-nums text-(--ink)">
            {formatPace(d.gap)}
          </span>{' '}
          {paceLabel}
        </p>
      )}
    </div>
  ))
  const HrTip = makeTooltip<ChartRow>((d) => (
    <p className="text-(--ink-2)">
      {d.dist.toFixed(2)} {distLabel} ·{' '}
      <span className="font-mono tabular-nums text-(--ink)">
        {Math.round(d.hr ?? 0)} bpm
      </span>
    </p>
  ))

  // ── KPIs ──
  const kpis: Array<{
    label: string
    value: string
    unit?: string
    detail?: string
    accent?: 'positive' | 'negative'
  }> = [
    { label: 'DISTANCE', value: toDisplayDistance(a.distanceMeters, unit), unit: distLabel },
    { label: 'MOVING TIME', value: formatDuration(a.movingTime) },
    { label: 'AVG PACE', value: formatPace(paceForUnit(a.avgSpeed, unit)), unit: paceLabel },
  ]
  if (stats.gapPaceSecPerKm !== null) {
    kpis.push({
      label: 'GAP',
      value: formatPace(toUnitPace(stats.gapPaceSecPerKm)),
      unit: paceLabel,
    })
  }
  if (a.avgHr !== null) {
    kpis.push({ label: 'AVG HR', value: String(Math.round(a.avgHr)), unit: 'bpm' })
  }
  if (a.cadenceSpm !== null) {
    kpis.push({ label: 'AVG CADENCE', value: String(a.cadenceSpm), unit: 'spm' })
  }
  kpis.push({ label: 'ELEV GAIN', value: String(Math.round(a.elevationGain)), unit: 'm' })
  if (stats.decoupling.applicable) {
    kpis.push({
      label: 'DECOUPLING',
      value: stats.decoupling.pct.toFixed(1),
      unit: '%',
      accent: stats.decoupling.pct > 5 ? 'negative' : 'positive',
    })
  } else if (detail.hasStreams && a.avgHr !== null) {
    // HR data exists but the run is too short or interval-like for the
    // first-vs-second-half comparison to be meaningful.
    kpis.push({
      label: 'DECOUPLING',
      value: 'n/a',
      detail: 'short / interval run',
    })
  }

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-2">
        <Link
          to="/dashboard/activities"
          className="text-meta no-underline hover:text-(--ink-2) transition-colors w-fit"
        >
          ← Activities
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-section text-(--ink)">{a.name}</h2>
            <div className="text-meta">
              {formatDate(a.date)} · {a.sportType ?? a.type}
              {detail.gear && ` · 👟 ${detail.gear.name}`}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <SyncActivityButton activityId={a.id} variant="ghost" label="Sync" />
            <StravaLink
              activityId={a.id}
              className="text-sm text-(--ink-3) no-underline"
            >
              View on Strava ↗
            </StravaLink>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <KpiCard
            key={k.label}
            label={k.label}
            value={k.value}
            unit={k.unit}
            detail={k.detail}
            accent={k.accent}
          />
        ))}
      </div>

      {!detail.hasStreams && (
        <Card className="p-10">
          <div className="flex flex-col items-center gap-4">
            <EmptyState>
              {detail.detailSynced
                ? 'No detailed data was recorded for this activity.'
                : "Detailed stream data hasn't synced for this activity yet."}
            </EmptyState>
            <SyncActivityButton activityId={a.id} />
          </div>
        </Card>
      )}

      {/* Elevation */}
      {channels.elev && (
        <Card className="p-4">
          <SectionHeader
            title="Elevation"
            subtitle={`${Math.round(a.elevationGain)} m gain`}
          />
          <ChartContainer height={180}>
            <AreaChart data={chartData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="dist"
                type="number"
                domain={[0, maxDist]}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={40}
                tickFormatter={(v: number) => String(Math.round(v))}
              />
              <Tooltip content={<ElevTip />} cursor={CURSOR} />
              <Area
                type="monotone"
                dataKey="elev"
                stroke="var(--accent)"
                strokeWidth={2}
                fill="url(#elevGradient)"
                dot={false}
                connectNulls
              />
            </AreaChart>
          </ChartContainer>
        </Card>
      )}

      {/* Pace (+ GAP overlay) */}
      {channels.pace && (
        <Card className="p-4">
          <SectionHeader
            title="Pace"
            subtitle={channels.grade ? 'raw vs grade-adjusted' : undefined}
          />
          <ChartContainer height={180}>
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <XAxis
                dataKey="dist"
                type="number"
                domain={[0, maxDist]}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <YAxis
                reversed
                domain={paceDomain}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={50}
                tickFormatter={(v: number) => formatPace(v)}
              />
              <Tooltip content={<PaceTip />} cursor={CURSOR} />
              <Line
                type="monotone"
                dataKey="pace"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              {channels.grade && (
                <Line
                  type="monotone"
                  dataKey="gap"
                  stroke="var(--ink-4)"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ChartContainer>
        </Card>
      )}

      {/* Heart rate (with zone bands) */}
      {channels.hr && (
        <Card className="p-4">
          <SectionHeader
            title="Heart rate"
            subtitle={a.avgHr !== null ? `avg ${Math.round(a.avgHr)} bpm` : undefined}
          />
          <ChartContainer height={180}>
            <LineChart data={chartData} margin={CHART_MARGIN}>
              <XAxis
                dataKey="dist"
                type="number"
                domain={[0, maxDist]}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v: number) => v.toFixed(1)}
              />
              <YAxis
                domain={[hrMin, hrMax]}
                axisLine={false}
                tickLine={false}
                tick={AXIS_TICK}
                width={36}
                tickFormatter={(v: number) => String(Math.round(v))}
              />
              {HR_ZONES.filter(
                (z) => z.min < hrMax && (z.max === Infinity || z.max > hrMin),
              ).map((z) => (
                <ReferenceArea
                  key={z.name}
                  y1={Math.max(z.min, hrMin)}
                  y2={z.max === Infinity ? hrMax : Math.min(z.max, hrMax)}
                  fill={z.color}
                  fillOpacity={0.1}
                  ifOverflow="hidden"
                />
              ))}
              <Tooltip content={<HrTip />} cursor={CURSOR} />
              <Line
                type="monotone"
                dataKey="hr"
                stroke="var(--ink-2)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ChartContainer>
        </Card>
      )}

      {/* Time in HR zones */}
      {stats.timeInZones && (
        <Card className="p-4">
          <SectionHeader title="Time in HR zones" />
          <div className="mt-3 flex flex-col gap-2">
            {HR_ZONES.map((z) => {
              const pct = stats.timeInZones?.[z.name] ?? 0
              return (
                <ZoneBar
                  key={z.name}
                  label={z.name}
                  color={z.color}
                  pct={pct}
                  active={pct > 0}
                  rightLabel={`${pct.toFixed(1)}%`}
                  labelWidth="w-32"
                />
              )
            })}
          </div>
        </Card>
      )}

      {/* Per-unit pace splits */}
      {unitSplits.length > 0 && (
        <Table
          table={paceSplitTable}
          title="Splits"
          subtitle={`per ${distLabel === 'mi' ? 'mile' : 'kilometer'}`}
          minWidth="360px"
        />
      )}

      {/* Laps */}
      {detail.laps.length > 0 && (
        <Table table={lapTable} title="Laps" minWidth="420px" />
      )}

      {/* Best efforts (fastest standard distances) */}
      {detail.splits.length > 0 && (
        <Table table={splitTable} title="Best efforts" minWidth="360px" />
      )}
    </>
  )
}
