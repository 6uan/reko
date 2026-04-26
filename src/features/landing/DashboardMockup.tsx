'use client'

import { useState, useMemo } from 'react'

/* ─── Mock data ─── */
const RUNS = [
  { name: "Tempo \u00b7 Regent\u2019s Park", date: "Apr 12", ts: 20260412, km: 5.02, sec: 1188, pr: "5K" as string | null },
  { name: "Easy lakes loop", date: "Apr 11", ts: 20260411, km: 8.10, sec: 2570, pr: null },
  { name: "Long Sunday", date: "Apr 07", ts: 20260407, km: 18.24, sec: 6180, pr: null },
  { name: "10 \u00d7 400m @ track", date: "Apr 04", ts: 20260404, km: 6.40, sec: 1680, pr: null },
  { name: "Commute home", date: "Apr 03", ts: 20260403, km: 4.10, sec: 1218, pr: null },
  { name: "10K race \u00b7 Hackney", date: "Mar 30", ts: 20260330, km: 10.00, sec: 2492, pr: "10K" as string | null },
  { name: "Recovery jog", date: "Mar 28", ts: 20260328, km: 5.20, sec: 1722, pr: null },
  { name: "Progression \u00b7 Hampstead", date: "Mar 26", ts: 20260326, km: 12.10, sec: 3456, pr: null },
]

const PACE_HISTORY = [305, 302, 298, 296, 294, 290, 288, 286, 284, 281, 280, 278, 276, 272, 281]

/* ─── Utility fns ─── */
function fmtTime(sec: number): string {
  sec = Math.round(sec)
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtPace(sec: number): string {
  sec = Math.round(sec)
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function fmtDist(km: number, unit: 'km' | 'mi'): string {
  if (unit === 'mi') return (km * 0.621371).toFixed(2)
  return km.toFixed(2)
}

function buildSparkline(data: number[], unit: 'km' | 'mi') {
  const converted = data.map(p => unit === 'km' ? p : p / 0.621371)
  const W = 260, H = 60, pad = 4
  const min = Math.min(...converted), max = Math.max(...converted)
  const range = max - min || 1
  const pts = converted.map((v, i) => {
    const x = pad + (i / (converted.length - 1)) * (W - pad * 2)
    const y = pad + ((v - min) / range) * (H - pad * 2)
    return [x, H - y] as const
  })
  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const fillD = `${lineD} L${W - pad},${H - pad} L${pad},${H - pad} Z`
  const last = pts[pts.length - 1]
  return { lineD, fillD, lastX: last[0], lastY: last[1] }
}

/* ─── Sort types ─── */
type SortKey = 'name' | 'date' | 'distance' | 'time' | 'pace'
type SortDir = 'asc' | 'desc'

/* ─── Sidebar icons ─── */
function IconOverview() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="6" rx="1" />
      <rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="7" rx="1" />
      <rect x="2" y="10" width="5" height="4" rx="1" />
    </svg>
  )
}

function IconActivities() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 14h12M4 14V8M8 14V4M12 14v-9" />
    </svg>
  )
}

function IconPRs() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="8" cy="6" r="3" />
      <path d="M4.5 14s.5-3.5 3.5-3.5S11.5 14 11.5 14" />
    </svg>
  )
}

function IconLeaderboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 13V6M8 13V3M13 13V9" />
    </svg>
  )
}

function IconTrends() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 11l4-5 3 3 5-6" />
      <circle cx="2" cy="11" r="1" />
      <circle cx="6" cy="6" r="1" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="14" cy="3" r="1" />
    </svg>
  )
}

function RunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="3.5" r="1.5" />
      <path d="M6 14l2-4 3 1 2-3" />
      <path d="M3 10l3-2" />
    </svg>
  )
}

/* ─── Component ─── */
export default function DashboardMockup() {
  const [unit, setUnit] = useState<'km' | 'mi'>('km')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedRuns = useMemo(() => {
    const arr = [...RUNS]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name); break
        case 'date': cmp = a.ts - b.ts; break
        case 'distance': cmp = a.km - b.km; break
        case 'time': cmp = a.sec - b.sec; break
        case 'pace': cmp = (a.sec / a.km) - (b.sec / b.km); break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [sortKey, sortDir])

  const sparkline = useMemo(() => buildSparkline(PACE_HISTORY, unit), [unit])

  /* Compute chart float values */
  const avgPace90d = PACE_HISTORY.reduce((a, b) => a + b, 0) / PACE_HISTORY.length
  const avgPaceConverted = unit === 'km' ? avgPace90d : avgPace90d / 0.621371
  const paceFirst = unit === 'km' ? PACE_HISTORY[0] : PACE_HISTORY[0] / 0.621371
  const paceDelta = paceFirst - avgPaceConverted

  /* KPI values */
  const weekKm = 31.4
  const avgPaceKpi = 272 // sec/km
  const longestKm = 18.2

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return null
    return <span className="ml-0.5 text-[var(--accent)]">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
  }

  const colHeaderClass = "cursor-pointer select-none hover:text-[var(--ink-2)] transition-colors duration-150"

  const NAV_ITEMS = [
    { label: 'Overview', icon: <IconOverview />, active: true },
    { label: 'Activities', icon: <IconActivities />, active: false },
    { label: 'Personal records', icon: <IconPRs />, active: false },
    { label: 'Leaderboard', icon: <IconLeaderboard />, active: false },
    { label: 'Trends', icon: <IconTrends />, active: false },
  ]

  return (
    <div className="relative mt-16 max-sm:mt-10" style={{ perspective: '1200px' }}>
      {/* Glow behind browser */}
      <div className="mockup-glow" />

      {/* Browser chrome frame */}
      <div className="relative z-10 rounded-[var(--radius-xl)] border border-[var(--line)] shadow-[var(--shadow-xl)] bg-[var(--card)] overflow-hidden">
        {/* Chrome top bar */}
        <div className="flex items-center px-4 py-2.5 bg-[var(--card-2)] border-b border-[var(--line)]">
          {/* Traffic lights */}
          <div className="flex gap-[7px]">
            <span className="w-[11px] h-[11px] rounded-full" style={{ background: '#f2baa5' }} />
            <span className="w-[11px] h-[11px] rounded-full" style={{ background: '#f3dca1' }} />
            <span className="w-[11px] h-[11px] rounded-full" style={{ background: '#b7d9a8' }} />
          </div>
          {/* Address bar */}
          <div className="flex-1 flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-[var(--bg)] border border-[var(--line-2)] rounded-full font-mono text-[11px] text-[var(--ink-3)]">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="opacity-50">
                <path d="M8 1a4 4 0 0 0-4 4v3H3a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1V5a4 4 0 0 0-4-4zm2 7H6V5a2 2 0 1 1 4 0v3z" />
              </svg>
              reko.run/dashboard
            </div>
          </div>
          <div className="w-[54px]" />
        </div>

        {/* Dashboard content */}
        <div className="flex min-h-[420px] max-sm:min-h-[320px]">
          {/* Sidebar */}
          <aside className="hidden lg:flex flex-col w-[200px] shrink-0 bg-[var(--card-2)] border-r border-[var(--line)] py-4 px-2.5">
            <div className="px-2.5 mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-4)]">
              Reko
            </div>
            <div className="flex flex-col gap-0.5">
              {NAV_ITEMS.map(item => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2.5 px-2.5 py-[7px] rounded-[var(--radius-s)] text-[13px] font-medium transition-colors duration-150 ${
                    item.active
                      ? 'bg-[var(--card)] shadow-[var(--shadow-s)] border border-[var(--line)] text-[var(--ink)]'
                      : 'text-[var(--ink-3)] hover:text-[var(--ink-2)] hover:bg-[var(--card)]'
                  }`}
                >
                  <span className={item.active ? 'text-[var(--accent)]' : ''}>{item.icon}</span>
                  {item.label}
                </div>
              ))}
            </div>
            <div className="flex-1" />
            {/* Profile */}
            <div className="flex items-center gap-2.5 px-2.5 py-2 mt-2 border-t border-[var(--line-2)] pt-3.5">
              <div className="w-7 h-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center font-mono text-[11px] font-semibold">
                M
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-medium text-[var(--ink)] leading-tight">mxv</span>
                <span className="text-[10px] text-[var(--ink-4)] font-mono leading-tight">synced 2m ago</span>
              </div>
            </div>
          </aside>

          {/* Main area */}
          <main className="flex-1 p-4 sm:p-5 overflow-x-auto">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <h2 className="text-[17px] font-semibold text-[var(--ink)] tracking-tight leading-tight">Overview</h2>
                <p className="font-mono text-[11px] text-[var(--ink-4)] mt-0.5">April 2026 &middot; 14 activities</p>
              </div>
              {/* Unit toggle */}
              <div className="flex rounded-[var(--radius-s)] border border-[var(--line)] overflow-hidden text-[12px] font-mono font-medium">
                <button
                  onClick={() => setUnit('km')}
                  className={`px-3 py-1.5 transition-colors duration-150 ${unit === 'km' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--card)] text-[var(--ink-3)] hover:text-[var(--ink-2)]'}`}
                >
                  km
                </button>
                <button
                  onClick={() => setUnit('mi')}
                  className={`px-3 py-1.5 transition-colors duration-150 ${unit === 'mi' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--card)] text-[var(--ink-3)] hover:text-[var(--ink-2)]'}`}
                >
                  mi
                </button>
              </div>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
              {/* This week */}
              <div className="bg-[var(--card-2)] border border-[var(--line-2)] rounded-[var(--radius-m)] p-3.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-4)]">This week</div>
                <div className="font-mono text-[22px] font-medium text-[var(--ink)] mt-1 leading-none">
                  {fmtDist(weekKm, unit)}
                  <span className="text-[12px] text-[var(--ink-4)] ml-1">{unit}</span>
                </div>
                <div className="font-mono text-[11px] text-green-600 mt-1.5">&uarr; 12% vs last week</div>
              </div>
              {/* Avg pace */}
              <div className="bg-[var(--card-2)] border border-[var(--line-2)] rounded-[var(--radius-m)] p-3.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-4)]">Avg pace</div>
                <div className="font-mono text-[22px] font-medium text-[var(--ink)] mt-1 leading-none">
                  {fmtPace(unit === 'km' ? avgPaceKpi : avgPaceKpi / 0.621371)}
                  <span className="text-[12px] text-[var(--ink-4)] ml-1">/{unit}</span>
                </div>
                <div className="font-mono text-[11px] text-green-600 mt-1.5">&darr; 0:08 vs April</div>
              </div>
              {/* Longest run */}
              <div className="bg-[var(--card-2)] border border-[var(--line-2)] rounded-[var(--radius-m)] p-3.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-4)]">Longest run</div>
                <div className="font-mono text-[22px] font-medium text-[var(--ink)] mt-1 leading-none">
                  {fmtDist(longestKm, unit)}
                  <span className="text-[12px] text-[var(--ink-4)] ml-1">{unit}</span>
                </div>
                <div className="font-mono text-[11px] text-[var(--ink-4)] mt-1.5">Sun &middot; easy</div>
              </div>
              {/* New PRs */}
              <div className="bg-[var(--card-2)] border border-[var(--line-2)] rounded-[var(--radius-m)] p-3.5">
                <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-4)]">New PRs</div>
                <div className="font-mono text-[22px] font-medium text-[var(--accent)] mt-1 leading-none">2</div>
                <div className="font-mono text-[11px] text-[var(--ink-4)] mt-1.5">5K &middot; 10K</div>
              </div>
            </div>

            {/* Activity table */}
            <div className="border border-[var(--line)] rounded-[var(--radius-m)] bg-[var(--card)] overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[480px]">
                <thead>
                  <tr className="bg-[var(--card-2)] font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-4)]">
                    <th className={`py-2.5 px-3.5 font-medium ${colHeaderClass}`} onClick={() => toggleSort('name')}>
                      Activity{sortIndicator('name')}
                    </th>
                    <th className={`py-2.5 px-3 font-medium ${colHeaderClass}`} onClick={() => toggleSort('date')}>
                      Date{sortIndicator('date')}
                    </th>
                    <th className={`py-2.5 px-3 font-medium ${colHeaderClass}`} onClick={() => toggleSort('distance')}>
                      Dist{sortIndicator('distance')}
                    </th>
                    <th className={`py-2.5 px-3 font-medium hidden sm:table-cell ${colHeaderClass}`} onClick={() => toggleSort('time')}>
                      Time{sortIndicator('time')}
                    </th>
                    <th className={`py-2.5 px-3 font-medium hidden sm:table-cell ${colHeaderClass}`} onClick={() => toggleSort('pace')}>
                      Pace{sortIndicator('pace')}
                    </th>
                    <th className="py-2.5 px-3 font-medium">PR</th>
                  </tr>
                </thead>
                <tbody className="text-[13px]">
                  {sortedRuns.map((run, i) => (
                    <tr
                      key={run.ts}
                      className={`hover:bg-[var(--card-2)] transition-colors duration-100 ${i < sortedRuns.length - 1 ? 'border-b border-[var(--line-2)]' : ''}`}
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[22px] h-[22px] rounded-md bg-[var(--card-2)] border border-[var(--line-2)] flex items-center justify-center text-[var(--ink-3)] shrink-0">
                            <RunIcon />
                          </div>
                          <span className="text-[var(--ink)] font-medium truncate max-w-[180px]">{run.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-[var(--ink-3)]">{run.date}</td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-[var(--ink-2)]">
                        {fmtDist(run.km, unit)} {unit}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-[var(--ink-2)] hidden sm:table-cell">
                        {fmtTime(run.sec)}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[12px] text-[var(--ink-2)] hidden sm:table-cell">
                        {fmtPace(unit === 'km' ? run.sec / run.km : (run.sec / run.km) / 0.621371)}/{unit}
                      </td>
                      <td className="py-2.5 px-3">
                        {run.pr && (
                          <span className="pb-chip inline-flex items-center gap-1.5 bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-mono font-medium px-2 py-0.5 rounded-full">
                            {run.pr}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </main>
        </div>
      </div>

      {/* Floating PB card */}
      <div className="pb-float hidden md:block absolute right-[-28px] top-[130px] lg:right-[-28px] lg:top-[130px] md:right-[-8px] md:top-[90px] md:scale-90 lg:scale-100 z-20" style={{ transform: 'rotate(1.5deg)' }}>
        <div className="pb-float-glow relative bg-[var(--card)] border border-[var(--line)] rounded-[var(--radius-m)] shadow-[var(--shadow-l)] p-4 w-[210px] overflow-hidden">
          {/* Ribbon */}
          <div className="absolute top-[-1px] left-4 bg-[var(--accent)] text-[var(--accent-ink)] text-[10px] font-mono font-semibold uppercase tracking-wider px-2.5 py-1 rounded-b-md shadow-[0_4px_12px_rgba(var(--accent-glow),0.3)]">
            New PR
          </div>
          <div className="mt-5">
            <div className="text-[13px] font-semibold text-[var(--ink)] leading-tight">5 kilometers</div>
            <div className="text-[11px] text-[var(--ink-4)] font-mono mt-0.5">Tempo &middot; Regent&rsquo;s Park</div>
            <div className="font-mono text-[28px] font-medium text-[var(--ink)] mt-2 leading-none">19:48</div>
            <div className="border-t border-dashed border-[var(--line)] mt-3 pt-2.5 flex items-center justify-between">
              <span className="font-mono text-[10px] text-[var(--ink-4)]">Apr 12, 2026</span>
              <span className="font-mono text-[11px] text-green-600 font-medium">&minus;0:23</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chart card */}
      <div className="chart-float hidden md:block absolute left-[-36px] bottom-[36px] lg:left-[-36px] md:left-[-8px] md:scale-90 lg:scale-100 z-20" style={{ transform: 'rotate(-1.2deg)' }}>
        <div className="relative bg-[var(--card)] border border-[var(--line)] rounded-[var(--radius-m)] shadow-[var(--shadow-l)] p-4 w-[296px]">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ink-4)]">Avg pace &middot; 90d</div>
              <div className="font-mono text-[22px] font-medium text-[var(--ink)] mt-0.5 leading-none">
                {fmtPace(avgPaceConverted)}
                <span className="text-[12px] text-[var(--ink-4)] ml-1">/{unit}</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[11px] font-mono font-medium px-2 py-0.5 rounded-full mt-1">
              &darr; {fmtPace(Math.round(paceDelta))}
            </span>
          </div>
          {/* Sparkline SVG */}
          <svg viewBox="0 0 260 60" className="w-full h-[60px]" preserveAspectRatio="none">
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.01" />
              </linearGradient>
            </defs>
            <path d={sparkline.fillD} fill="url(#spark-fill)" />
            <path d={sparkline.lineD} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={sparkline.lastX} cy={sparkline.lastY} r="3.5" fill="var(--accent)" />
            <circle cx={sparkline.lastX} cy={sparkline.lastY} r="6" fill="var(--accent)" fillOpacity="0.15" />
          </svg>
        </div>
      </div>
    </div>
  )
}
