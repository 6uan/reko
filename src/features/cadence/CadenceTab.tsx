import { useMemo } from 'react'
import {
  speedToPaceSeconds,
  formatPace,
} from '../../lib/strava'

// ── Types ─────────────────────────────────────────────────────────

export type DashboardRun = {
  id: number
  name: string
  date: string
  distanceMeters: number
  movingTime: number
  avgSpeed: number
  avgHr: number | null
  maxHr: number | null
  cadence: number | null
  elevation: number
  prCount: number
}

type Props = {
  runs: DashboardRun[]
  unit: 'km' | 'mi'
}

// ── Helpers ───────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function linearRegression(pts: { x: number; y: number }[]) {
  const n = pts.length
  if (n < 2) return { slope: 0, intercept: 0 }
  const sx = pts.reduce((a, p) => a + p.x, 0)
  const sy = pts.reduce((a, p) => a + p.y, 0)
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0)
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0)
  const denom = n * sxx - sx * sx
  if (denom === 0) return { slope: 0, intercept: sy / n }
  const slope = (n * sxy - sx * sy) / denom
  const intercept = (sy - slope * sx) / n
  return { slope, intercept }
}

function paceForUnit(speedMs: number, unit: 'km' | 'mi'): number {
  const paceSec = speedToPaceSeconds(speedMs)
  return unit === 'mi' ? paceSec * 1.60934 : paceSec
}

// ── Component ─────────────────────────────────────────────────────

export default function Cadence({ runs, unit }: Props) {
  const withCadence = useMemo(
    () => runs.filter((r) => r.cadence != null && r.cadence > 0),
    [runs],
  )

  // ── KPI computations ──────────────────────────────────────────

  const avgCadence30d = useMemo(
    () => mean(withCadence.map((r) => r.cadence!)),
    [withCadence],
  )

  const fastestCadence = useMemo(
    () =>
      withCadence.length > 0
        ? Math.max(...withCadence.map((r) => r.cadence!))
        : 0,
    [withCadence],
  )

  const easyCadence = useMemo(() => {
    const easy = withCadence.filter((r) => r.avgHr != null && r.avgHr < 150)
    return mean(easy.map((r) => r.cadence!))
  }, [withCadence])

  const baseline = avgCadence30d

  // ── Histogram bins ────────────────────────────────────────────

  const BIN_WIDTH = 2
  const BIN_START = 158
  const BIN_END = 188

  const histogram = useMemo(() => {
    const bins: { lo: number; hi: number; count: number }[] = []
    for (let lo = BIN_START; lo < BIN_END; lo += BIN_WIDTH) {
      bins.push({ lo, hi: lo + BIN_WIDTH, count: 0 })
    }
    withCadence.forEach((r) => {
      const c = r.cadence!
      const idx = Math.floor((c - BIN_START) / BIN_WIDTH)
      if (idx >= 0 && idx < bins.length) bins[idx].count++
    })
    return bins
  }, [withCadence])

  const histMax = useMemo(
    () => Math.max(1, ...histogram.map((b) => b.count)),
    [histogram],
  )

  // ── Scatter plot data ─────────────────────────────────────────

  const scatterData = useMemo(
    () =>
      withCadence.map((r) => ({
        cadence: r.cadence!,
        pace: paceForUnit(r.avgSpeed, unit),
      })),
    [withCadence, unit],
  )

  const regression = useMemo(
    () =>
      linearRegression(
        scatterData.map((d) => ({ x: d.pace, y: d.cadence })),
      ),
    [scatterData],
  )

  // scatter axis ranges
  const paceValues = scatterData.map((d) => d.pace)
  const cadenceValues = scatterData.map((d) => d.cadence)
  const paceMin = paceValues.length > 0 ? Math.min(...paceValues) - 10 : 240
  const paceMax = paceValues.length > 0 ? Math.max(...paceValues) + 10 : 420
  const cadMin =
    cadenceValues.length > 0 ? Math.min(...cadenceValues) - 4 : 154
  const cadMax =
    cadenceValues.length > 0 ? Math.max(...cadenceValues) + 4 : 192

  // ── Table data ────────────────────────────────────────────────

  const tableRows = useMemo(
    () =>
      withCadence.map((r) => {
        const cad = r.cadence!
        const stride = r.avgSpeed / (cad / 60)
        const delta = cad - baseline
        const pace = paceForUnit(r.avgSpeed, unit)
        return { run: r, cad, stride, delta, pace }
      }),
    [withCadence, baseline, unit],
  )

  // ── Render helpers ────────────────────────────────────────────

  function scatterX(pace: number) {
    return 40 + ((pace - paceMin) / (paceMax - paceMin)) * 480
  }
  function scatterY(cad: number) {
    return 180 - ((cad - cadMin) / (cadMax - cadMin)) * 160
  }

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Avg cadence 30d */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Avg cadence &middot; 30d
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {avgCadence30d > 0 ? Math.round(avgCadence30d) : '—'}
            <span className="text-[13px] text-[var(--ink-3)] ml-0.5 font-normal">
              spm
            </span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-[var(--ink-3)]">
            {withCadence.length} runs with cadence
          </div>
        </div>

        {/* Fastest cadence */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Fastest cadence
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {fastestCadence > 0 ? fastestCadence : '—'}
            <span className="text-[13px] text-[var(--ink-3)] ml-0.5 font-normal">
              spm
            </span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-[var(--ink-3)]">
            Peak from any run
          </div>
        </div>

        {/* Easy cadence */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Easy cadence
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {easyCadence > 0 ? Math.round(easyCadence) : '—'}
            <span className="text-[13px] text-[var(--ink-3)] ml-0.5 font-normal">
              spm
            </span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-[var(--ink-3)]">
            Avg HR &lt; 150 bpm
          </div>
        </div>

        {/* Baseline */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Baseline
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {baseline > 0 ? Math.round(baseline) : '—'}
            <span className="text-[13px] text-[var(--ink-3)] ml-0.5 font-normal">
              spm
            </span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-[var(--ink-3)]">
            30d rolling avg
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
        {/* Histogram */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] mb-3">
            Cadence distribution &middot; all runs
          </div>
          <svg viewBox="0 0 560 200" className="w-full" role="img">
            {histogram.map((bin, i) => {
              const barW = 480 / histogram.length - 2
              const barH = (bin.count / histMax) * 160
              const x = 40 + i * (480 / histogram.length) + 1
              const y = 180 - barH
              const isBaseline =
                baseline >= bin.lo && baseline < bin.hi
              return (
                <rect
                  key={bin.lo}
                  x={x}
                  y={y}
                  width={barW}
                  height={barH}
                  rx={2}
                  fill={isBaseline ? 'var(--accent)' : '#d6cfbc'}
                />
              )
            })}

            {/* Baseline dashed line */}
            {baseline > 0 && (
              <line
                x1={
                  40 +
                  ((baseline - BIN_START) / (BIN_END - BIN_START)) * 480
                }
                y1={10}
                x2={
                  40 +
                  ((baseline - BIN_START) / (BIN_END - BIN_START)) * 480
                }
                y2={180}
                stroke="var(--accent)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            )}

            {/* X-axis labels every 4th bin */}
            {histogram.map((bin, i) =>
              i % 4 === 0 ? (
                <text
                  key={`label-${bin.lo}`}
                  x={40 + i * (480 / histogram.length) + (480 / histogram.length) / 2}
                  y={196}
                  textAnchor="middle"
                  fill="var(--ink-4)"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                >
                  {bin.lo}
                </text>
              ) : null,
            )}
          </svg>
        </div>

        {/* Scatter plot */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] mb-3">
            Cadence vs pace
          </div>
          <svg viewBox="0 0 560 200" className="w-full" role="img">
            {/* Box border */}
            <rect
              x={40}
              y={10}
              width={480}
              height={170}
              fill="none"
              stroke="var(--line-2)"
              strokeWidth={1}
            />

            {/* Dots */}
            {scatterData.map((d, i) => (
              <circle
                key={i}
                cx={scatterX(d.pace)}
                cy={scatterY(d.cadence)}
                r={4}
                fill="var(--accent)"
                opacity={0.7}
              />
            ))}

            {/* Regression line */}
            {scatterData.length >= 2 && (
              <line
                x1={scatterX(paceMin)}
                y1={scatterY(
                  regression.slope * paceMin + regression.intercept,
                )}
                x2={scatterX(paceMax)}
                y2={scatterY(
                  regression.slope * paceMax + regression.intercept,
                )}
                stroke="#666"
                strokeWidth={1.5}
                strokeDasharray="6 4"
              />
            )}

            {/* Axis labels */}
            <text
              x={44}
              y={196}
              fill="var(--ink-4)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              slower &rarr;
            </text>
            <text
              x={516}
              y={196}
              textAnchor="end"
              fill="var(--ink-4)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              &larr; faster
            </text>
            <text
              x={16}
              y={14}
              fill="var(--ink-4)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              spm &uarr;
            </text>
          </svg>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Activity
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Avg cadence
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Pace
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  Stride length
                </th>
                <th className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)] px-3 py-2.5 text-left font-medium">
                  &Delta; vs baseline
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => {
                const deltaColor =
                  row.delta > 0 ? 'var(--ok)' : 'var(--ink-3)'
                const deltaPrefix = row.delta > 0 ? '+' : ''
                return (
                  <tr key={row.run.id}>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-medium text-[var(--ink)]">
                      {row.run.name}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {row.cad}
                      <span className="text-[var(--ink-3)] ml-0.5">
                        spm
                      </span>
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {formatPace(row.pace)}/{unit}
                    </td>
                    <td className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums text-[var(--ink)]">
                      {row.stride.toFixed(2)}
                      <span className="text-[var(--ink-3)] ml-0.5">
                        m
                      </span>
                    </td>
                    <td
                      className="px-3 py-3 border-b border-[var(--line-2)] text-[13px] font-mono tabular-nums"
                      style={{ color: deltaColor }}
                    >
                      {deltaPrefix}
                      {Math.round(row.delta)} spm
                    </td>
                  </tr>
                )
              })}
              {tableRows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[13px] text-[var(--ink-3)]"
                  >
                    No runs with cadence data
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
