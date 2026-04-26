import { useMemo } from 'react'

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

type Props = { runs: DashboardRun[]; unit: 'km' | 'mi' }

// ── Zone definitions ──────────────────────────────────────────────

const ZONES = [
  { name: 'Z1 Recovery', min: 0, max: 124, color: 'var(--hr-1)' },
  { name: 'Z2 Aerobic', min: 124, max: 143, color: 'var(--hr-2)' },
  { name: 'Z3 Tempo', min: 143, max: 162, color: 'var(--hr-3)' },
  { name: 'Z4 Threshold', min: 162, max: 181, color: 'var(--hr-4)' },
  { name: 'Z5 VO\u2082max', min: 181, max: Infinity, color: 'var(--hr-5)' },
] as const

function zoneFor(hr: number) {
  return ZONES.find((z) => hr >= z.min && hr < z.max) ?? ZONES[4]
}

function avg(nums: number[]) {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0
}

// ── Component ─────────────────────────────────────────────────────

export default function HeartRate({ runs }: Props) {
  // ── 30-day filter ───────────────────────────────────────────────

  const thirtyDayRuns = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    return runs.filter((r) => new Date(r.date) >= cutoff)
  }, [runs])

  // ── KPI: avg HR 30d ─────────────────────────────────────────────

  const avgHr30 = useMemo(() => {
    const hrs = thirtyDayRuns.map((r) => r.avgHr).filter((h): h is number => h !== null)
    return Math.round(avg(hrs))
  }, [thirtyDayRuns])

  // ── KPI: max HR seen ────────────────────────────────────────────

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

  // ── KPI: Z2 share ──────────────────────────────────────────────

  const z2Share = useMemo(() => {
    const withHr = runs.filter((r) => r.avgHr !== null)
    if (!withHr.length) return 0
    const inZ2 = withHr.filter((r) => r.avgHr! >= 124 && r.avgHr! < 143)
    return Math.round((inZ2.length / withHr.length) * 100)
  }, [runs])

  // ── Zone time distribution (30d) ───────────────────────────────

  const zoneDistribution = useMemo(() => {
    const totals = ZONES.map(() => 0)
    let totalTime = 0
    for (const r of thirtyDayRuns) {
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
  }, [thirtyDayRuns])

  // ── 90-day maxHR points ─────────────────────────────────────────

  const maxHrPoints = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    return runs
      .filter((r) => new Date(r.date) >= cutoff && r.maxHr !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((r) => ({ date: r.date, value: r.maxHr! }))
  }, [runs])

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard
          label="Avg HR · 30d"
          value={avgHr30 || '—'}
          unit="bpm"
          detail={`${thirtyDayRuns.filter((r) => r.avgHr !== null).length} runs with HR data`}
        />
        <KpiCard
          label="Resting HR"
          value={48}
          unit="bpm"
          detail="Not available from activity data"
          detailGreen={false}
          mock
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
          detail="Runs with avg HR 124-143"
          detailGreen={z2Share >= 60}
        />
      </div>

      {/* Two charts side by side */}
      <div className="grid grid-cols-2 gap-4">
        {/* Zone distribution bars */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-baseline mb-4">
            <h3 className="text-[15px] font-medium">Time in zones · last 30 days</h3>
            <span className="font-mono text-[11px] text-[var(--ink-3)]">
              {thirtyDayRuns.filter((r) => r.avgHr !== null).length} runs
            </span>
          </div>
          <div className="space-y-3">
            {zoneDistribution.map((zone) => (
              <div key={zone.name} className="grid items-center gap-3" style={{ gridTemplateColumns: '100px 1fr 60px' }}>
                <span className="font-mono text-[11px] text-[var(--ink-3)] truncate">
                  {zone.name}
                </span>
                <div className="h-2.5 rounded-full bg-[var(--line-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${zone.pct}%`,
                      backgroundColor: zone.color,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] text-[var(--ink-3)] text-right tabular-nums">
                  {zone.pct.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Aerobic decoupling (mock) */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-[18px]">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-[15px] font-medium">Aerobic decoupling</h3>
            <span className="font-mono text-[11px] text-[var(--ink-3)]">mock data</span>
          </div>
          <DecouplingChart />
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-3)]">
              <span className="inline-block w-3 h-0.5 rounded-full bg-[var(--accent)]" />
              Heart rate
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-3)]">
              <span
                className="inline-block w-3 h-0.5 rounded-full"
                style={{ backgroundColor: '#666' }}
              />
              Pace
            </span>
          </div>
        </div>
      </div>

      {/* Bottom chart: resting & max HR 90 days */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-[18px]">
        <div className="flex justify-between items-baseline mb-3">
          <h3 className="text-[15px] font-medium">Resting &amp; max HR · 90 days</h3>
          <span className="font-mono text-[11px] text-[var(--ink-3)]">
            {maxHrPoints.length} data points
          </span>
        </div>
        <HrTrendChart maxHrPoints={maxHrPoints} />
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-3)]">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: 'var(--hr-1)' }} />
            Resting HR (mock)
          </span>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-[var(--ink-3)]">
            <span className="inline-block w-3 h-0.5 rounded-full" style={{ backgroundColor: 'var(--hr-5)' }} />
            Max HR
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  unit,
  detail,
  detailGreen,
  mock,
}: {
  label: string
  value: string | number
  unit: string
  detail: string
  detailGreen?: boolean
  mock?: boolean
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
      <div className="font-mono text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
        {label}
      </div>
      <div className="font-mono text-[26px] font-medium tracking-tight tabular-nums mt-1.5">
        {value}
        <span className="text-[13px] text-[var(--ink-3)] ml-0.5 font-normal">{unit}</span>
      </div>
      <div
        className={`font-mono text-[11px] mt-1.5 ${
          detailGreen ? 'text-[var(--ok)]' : 'text-[var(--ink-3)]'
        }`}
      >
        {detail}
        {mock && <span className="ml-1 opacity-60">(mock)</span>}
      </div>
    </div>
  )
}

function DecouplingChart() {
  // Generate mock: HR gently rising, pace slightly rising
  const points = 20
  const padL = 10
  const padR = 10
  const padT = 10
  const padB = 10
  const w = 560 - padL - padR
  const h = 150 - padT - padB

  const hrPoints: { x: number; y: number }[] = []
  const pacePoints: { x: number; y: number }[] = []

  for (let i = 0; i < points; i++) {
    const x = padL + (i / (points - 1)) * w
    // HR: starts around 140, gently rises to ~160 with some noise
    const hrVal = 140 + (i / (points - 1)) * 20 + Math.sin(i * 0.7) * 3
    // Pace: starts around 280s (4:40), gently rises to ~295s (4:55)
    const paceVal = 280 + (i / (points - 1)) * 15 + Math.sin(i * 0.9) * 4

    // Normalize: HR 130-170, Pace 270-310
    const hrY = padT + h - ((hrVal - 130) / 40) * h
    const paceY = padT + h - ((310 - paceVal) / 40) * h

    hrPoints.push({ x, y: hrY })
    pacePoints.push({ x, y: paceY })
  }

  const hrLine = hrPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const paceLine = pacePoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  return (
    <svg viewBox="0 0 560 150" className="w-full">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => (
        <line
          key={frac}
          x1={padL}
          y1={padT + frac * h}
          x2={padL + w}
          y2={padT + frac * h}
          stroke="var(--line-2)"
          strokeWidth={0.5}
        />
      ))}
      <path d={paceLine} fill="none" stroke="#666" strokeWidth={1.5} strokeDasharray="4 3" />
      <path d={hrLine} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
}

function HrTrendChart({ maxHrPoints }: { maxHrPoints: { date: string; value: number }[] }) {
  const padL = 40
  const padR = 10
  const padT = 10
  const padB = 24
  const chartW = 800 - padL - padR
  const chartH = 200 - padT - padB

  // Mock RHR: gently declining from ~52 to ~47 over 90 days
  const mockRhrPoints = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    const count = 14
    for (let i = 0; i < count; i++) {
      const x = padL + (i / (count - 1)) * chartW
      const rhr = 52 - (i / (count - 1)) * 5 + Math.sin(i * 0.8) * 1.5
      pts.push({ x, y: rhr })
    }
    return pts
  }, [])

  if (!maxHrPoints.length) {
    return (
      <svg viewBox="0 0 800 200" className="w-full">
        <text x="400" y="110" textAnchor="middle" fill="var(--ink-4)" fontSize="12">
          No heart rate data in the last 90 days
        </text>
      </svg>
    )
  }

  // Y range: from ~40 (RHR low) to max HR + margin
  const allMaxVals = maxHrPoints.map((p) => p.value)
  const yMin = 40
  const yMax = Math.max(...allMaxVals) + 5

  const toY = (val: number) => padT + chartH - ((val - yMin) / (yMax - yMin)) * chartH

  // Date range
  const now = new Date()
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 90)
  const dateRange = now.getTime() - cutoff.getTime()
  const toX = (dateStr: string) => {
    const t = new Date(dateStr).getTime() - cutoff.getTime()
    return padL + (t / dateRange) * chartW
  }

  // Max HR line
  const maxPts = maxHrPoints.map((p) => ({
    x: toX(p.date),
    y: toY(p.value),
  }))
  const maxLine = maxPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  // Mock RHR line (use same y-scale)
  const rhrLine = mockRhrPoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${toY(p.y)}`)
    .join(' ')

  // Grid lines
  const gridValues = [60, 80, 100, 120, 140, 160, 180].filter((v) => v >= yMin && v <= yMax)

  return (
    <svg viewBox="0 0 800 200" className="w-full">
      <defs>
        <pattern id="hrGridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--line-2)" strokeWidth={0.3} />
        </pattern>
      </defs>
      <rect x={padL} y={padT} width={chartW} height={chartH} fill="url(#hrGridPattern)" />

      {/* Y-axis labels */}
      {gridValues.map((v) => (
        <g key={v}>
          <line
            x1={padL}
            y1={toY(v)}
            x2={padL + chartW}
            y2={toY(v)}
            stroke="var(--line-2)"
            strokeWidth={0.5}
          />
          <text
            x={padL - 6}
            y={toY(v) + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="var(--font-mono)"
            fill="var(--ink-4)"
          >
            {v}
          </text>
        </g>
      ))}

      {/* RHR mock line */}
      <path d={rhrLine} fill="none" stroke="var(--hr-1)" strokeWidth={2} strokeLinejoin="round" />

      {/* Max HR line */}
      <path d={maxLine} fill="none" stroke="var(--hr-5)" strokeWidth={2} strokeLinejoin="round" />
      {maxPts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="var(--hr-5)" />
      ))}
    </svg>
  )
}
