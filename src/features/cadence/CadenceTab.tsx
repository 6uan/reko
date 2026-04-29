import { useMemo } from 'react'
import { formatPace } from '../../lib/strava'
import { paceForUnit, type DashboardRun, type Unit } from '../../lib/activities'

type Props = {
  runs: DashboardRun[]
  unit: Unit
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

// ── Cadence range definitions ────────────────────────────────────

const CADENCE_RANGES = [
  { label: '185+', min: 185, max: Infinity },
  { label: '180-184', min: 180, max: 185 },
  { label: '175-179', min: 175, max: 180 },
  { label: '170-174', min: 170, max: 175 },
  { label: '165-169', min: 165, max: 170 },
  { label: '160-164', min: 160, max: 165 },
  { label: '<160', min: 0, max: 160 },
]

// ── Component ─────────────────────────────────────────────────────

export default function Cadence({ runs, unit }: Props) {
  const withCadence = useMemo(
    () => runs.filter((r) => r.cadence != null && r.cadence > 0),
    [runs],
  )

  // ── Best pace per cadence range (highest cadence first) ───────

  const bestByRange = useMemo(() => {
    return CADENCE_RANGES.map((range) => {
      const inRange = withCadence.filter(
        (r) => r.cadence! >= range.min && r.cadence! < range.max,
      )
      if (inRange.length === 0) return { ...range, bestRun: null, count: 0 }

      // Best pace = highest avgSpeed (fastest)
      const bestRun = inRange.reduce((best, r) =>
        r.avgSpeed > best.avgSpeed ? r : best,
      )
      return { ...range, bestRun, count: inRange.length }
    })
  }, [withCadence])

  // ── KPIs ──────────────────────────────────────────────────────

  const highestCadence = useMemo(() => {
    if (withCadence.length === 0) return null
    return withCadence.reduce((best, r) =>
      r.cadence! > best.cadence! ? r : best,
    )
  }, [withCadence])

  const avgCadence = useMemo(() => {
    if (withCadence.length === 0) return 0
    return Math.round(
      withCadence.reduce((s, r) => s + r.cadence!, 0) / withCadence.length,
    )
  }, [withCadence])

  const fastestAtHighCadence = useMemo(() => {
    const high = withCadence.filter((r) => r.cadence! >= 180)
    if (high.length === 0) return null
    return high.reduce((best, r) => (r.avgSpeed > best.avgSpeed ? r : best))
  }, [withCadence])

  // ── Scatter data ──────────────────────────────────────────────

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

  const paceValues = scatterData.map((d) => d.pace)
  const cadenceValues = scatterData.map((d) => d.cadence)
  const paceMin = paceValues.length > 0 ? Math.min(...paceValues) - 10 : 240
  const paceMax = paceValues.length > 0 ? Math.max(...paceValues) + 10 : 420
  const cadMin = cadenceValues.length > 0 ? Math.min(...cadenceValues) - 4 : 154
  const cadMax = cadenceValues.length > 0 ? Math.max(...cadenceValues) + 4 : 192

  function scatterX(pace: number) {
    return 40 + ((pace - paceMin) / (paceMax - paceMin)) * 480
  }
  function scatterY(cad: number) {
    return 180 - ((cad - cadMin) / (cadMax - cadMin)) * 160
  }

  // ── All runs sorted by cadence (highest first) ────────────────

  const sortedRuns = useMemo(
    () => [...withCadence].sort((a, b) => b.cadence! - a.cadence!),
    [withCadence],
  )

  const unitLabel = unit === 'mi' ? '/mi' : '/km'

  // ── JSX ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Highest cadence
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {highestCadence ? highestCadence.cadence : '—'}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">spm</span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            {highestCadence ? highestCadence.name : 'No data'}
          </div>
        </div>

        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Average cadence
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {avgCadence > 0 ? avgCadence : '—'}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">spm</span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            {withCadence.length} runs with cadence
          </div>
        </div>

        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Best pace at 180+ spm
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {fastestAtHighCadence
              ? formatPace(paceForUnit(fastestAtHighCadence.avgSpeed, unit))
              : '—'}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">{unitLabel}</span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            {fastestAtHighCadence ? fastestAtHighCadence.name : 'No runs at 180+'}
          </div>
        </div>

        <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4)">
            Cadence ranges hit
          </div>
          <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
            {bestByRange.filter((r) => r.bestRun !== null).length}
            <span className="text-[13px] text-(--ink-3) ml-0.5 font-normal">
              / {CADENCE_RANGES.length}
            </span>
          </div>
          <div className="font-mono text-[11px] mt-1.5 text-(--ink-3)">
            Ranges with data
          </div>
        </div>
      </div>

      {/* Best pace per cadence range */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-(--line)">
          <h3 className="text-[15px] font-medium text-(--ink)">
            Best pace at each cadence range
          </h3>
          <p className="font-mono text-[11px] text-(--ink-4) mt-0.5">
            Highest cadence first
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-150">
            <thead>
              <tr>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Cadence range
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Best pace
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Activity
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
              {bestByRange.map((range) => (
                <tr key={range.label}>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-medium text-(--ink)">
                    {range.label}
                    <span className="text-(--ink-3) ml-0.5">spm</span>
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums">
                    {range.bestRun ? (
                      <span className="text-(--accent) font-medium">
                        {formatPace(paceForUnit(range.bestRun.avgSpeed, unit))}
                        <span className="text-(--ink-3) font-normal ml-0.5">
                          {unitLabel}
                        </span>
                      </span>
                    ) : (
                      <span className="text-(--ink-4)">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] text-(--ink-3)">
                    {range.bestRun?.name ?? '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3)">
                    {range.bestRun
                      ? new Date(range.bestRun.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3) text-right">
                    {range.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scatter plot */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] p-4">
        <div className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4) mb-3">
          Cadence vs pace
        </div>
        <svg viewBox="0 0 560 200" className="w-full" role="img">
          <rect
            x={40}
            y={10}
            width={480}
            height={170}
            fill="none"
            stroke="var(--line-2)"
            strokeWidth={1}
          />

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

          {scatterData.length >= 2 && (
            <line
              x1={scatterX(paceMin)}
              y1={scatterY(regression.slope * paceMin + regression.intercept)}
              x2={scatterX(paceMax)}
              y2={scatterY(regression.slope * paceMax + regression.intercept)}
              stroke="#666"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
          )}

          <text x={44} y={196} fill="var(--ink-4)" fontSize={9} fontFamily="var(--font-mono)">
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
          <text x={16} y={14} fill="var(--ink-4)" fontSize={9} fontFamily="var(--font-mono)">
            spm &uarr;
          </text>
        </svg>
      </div>

      {/* All runs table sorted by cadence */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] overflow-hidden">
        <div className="px-4 py-3 border-b border-(--line)">
          <h3 className="text-[15px] font-medium text-(--ink)">
            All runs by cadence
          </h3>
          <p className="font-mono text-[11px] text-(--ink-4) mt-0.5">
            Highest first
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-150">
            <thead>
              <tr>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Activity
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Cadence
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Pace
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Stride
                </th>
                <th className="bg-(--card-2) font-mono text-[10px] uppercase tracking-widest text-(--ink-4) px-3 py-2.5 text-left font-medium">
                  Date
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRuns.map((run) => {
                const pace = paceForUnit(run.avgSpeed, unit)
                const stride = run.avgSpeed / (run.cadence! / 60)
                return (
                  <tr key={run.id}>
                    <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-medium text-(--ink)">
                      {run.name}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink)">
                      {run.cadence}
                      <span className="text-(--ink-3) ml-0.5">spm</span>
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink)">
                      {formatPace(pace)}{unitLabel}
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink)">
                      {stride.toFixed(2)}
                      <span className="text-(--ink-3) ml-0.5">m</span>
                    </td>
                    <td className="px-3 py-3 border-b border-(--line-2) text-[13px] font-mono tabular-nums text-(--ink-3)">
                      {new Date(run.date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                )
              })}
              {sortedRuns.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-[13px] text-(--ink-3)"
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
