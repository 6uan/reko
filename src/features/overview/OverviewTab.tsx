import { useMemo } from "react";
import {
  speedToPaceSeconds,
  formatPace,
  formatDistanceKm,
  formatDuration,
  getMonday,
} from "../../lib/strava";

// ── Types ──────────────────────────────────────────────────────────

export type DashboardRun = {
  id: number;
  name: string;
  date: string;
  distanceMeters: number;
  movingTime: number;
  avgSpeed: number;
  avgHr: number | null;
  maxHr: number | null;
  cadence: number | null;
  elevation: number;
  prCount: number;
};

type Props = {
  runs: DashboardRun[];
  unit: "km" | "mi";
};

// ── Helpers ────────────────────────────────────────────────────────

const KM_PER_MI = 1609.34;

function toDisplayDistance(meters: number, unit: "km" | "mi"): string {
  if (unit === "mi") return (meters / KM_PER_MI).toFixed(2);
  return formatDistanceKm(meters);
}

function paceForUnit(speedMs: number, unit: "km" | "mi"): number {
  if (speedMs <= 0) return 0;
  if (unit === "mi") return KM_PER_MI / speedMs;
  return speedToPaceSeconds(speedMs);
}

function isSameWeek(d1: Date, d2: Date): boolean {
  return getMonday(d1).getTime() === getMonday(d2).getTime();
}

function isSameMonth(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}%`;
}

// ── Component ──────────────────────────────────────────────────────

export default function Overview({ runs, unit }: Props) {
  const today = useMemo(() => new Date(), []);

  // ── Derived data ─────────────────────────────────────────────────

  const thisWeekRuns = useMemo(
    () => runs.filter((r) => isSameWeek(new Date(r.date), today)),
    [runs, today],
  );

  const lastWeekRuns = useMemo(() => {
    const lastWeekDate = new Date(today);
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    return runs.filter((r) => isSameWeek(new Date(r.date), lastWeekDate));
  }, [runs, today]);

  const thisMonthRuns = useMemo(
    () => runs.filter((r) => isSameMonth(new Date(r.date), today)),
    [runs, today],
  );

  const lastMonthRuns = useMemo(() => {
    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return runs.filter((r) => isSameMonth(new Date(r.date), lm));
  }, [runs, today]);

  // KPI 1 — This Week distance
  const thisWeekDist = thisWeekRuns.reduce((s, r) => s + r.distanceMeters, 0);
  const lastWeekDist = lastWeekRuns.reduce((s, r) => s + r.distanceMeters, 0);

  // KPI 2 — Avg Pace this month
  const avgPaceThis = useMemo(() => {
    if (thisMonthRuns.length === 0) return 0;
    const totalPace = thisMonthRuns.reduce(
      (s, r) => s + paceForUnit(r.avgSpeed, unit),
      0,
    );
    return totalPace / thisMonthRuns.length;
  }, [thisMonthRuns, unit]);

  const avgPaceLast = useMemo(() => {
    if (lastMonthRuns.length === 0) return 0;
    const totalPace = lastMonthRuns.reduce(
      (s, r) => s + paceForUnit(r.avgSpeed, unit),
      0,
    );
    return totalPace / lastMonthRuns.length;
  }, [lastMonthRuns, unit]);

  // KPI 3 — Longest run this month
  const longestRun = useMemo(() => {
    if (thisMonthRuns.length === 0) return null;
    return thisMonthRuns.reduce((best, r) =>
      r.distanceMeters > best.distanceMeters ? r : best,
    );
  }, [thisMonthRuns]);

  // KPI 4 — PRs this month
  const prCountMonth = thisMonthRuns.reduce((s, r) => s + r.prCount, 0);

  // Chart: Weekly distance (12 weeks)
  const weeklyBuckets = useMemo(() => {
    const buckets: { label: string; value: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const mon = getMonday(d);
      const weekRuns = runs.filter(
        (r) => getMonday(new Date(r.date)).getTime() === mon.getTime(),
      );
      const dist = weekRuns.reduce((s, r) => s + r.distanceMeters, 0);
      const label = `${mon.getMonth() + 1}/${mon.getDate()}`;
      buckets.push({
        label,
        value: unit === "mi" ? dist / KM_PER_MI : dist / 1000,
      });
    }
    return buckets;
  }, [runs, today, unit]);

  const maxWeeklyDist = Math.max(...weeklyBuckets.map((b) => b.value), 1);

  // Chart: Avg pace 90d (weekly points)
  const pacePoints = useMemo(() => {
    const points: { week: number; pace: number }[] = [];
    for (let i = 12; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i * 7);
      const mon = getMonday(d);
      const weekRuns = runs.filter(
        (r) => getMonday(new Date(r.date)).getTime() === mon.getTime(),
      );
      if (weekRuns.length === 0) continue;
      const avg =
        weekRuns.reduce((s, r) => s + paceForUnit(r.avgSpeed, unit), 0) /
        weekRuns.length;
      points.push({ week: 12 - i, pace: avg });
    }
    return points;
  }, [runs, today, unit]);

  const paceMin = pacePoints.length
    ? Math.min(...pacePoints.map((p) => p.pace)) * 0.95
    : 0;
  const paceMax = pacePoints.length
    ? Math.max(...pacePoints.map((p) => p.pace)) * 1.05
    : 1;

  // Recent runs (first 8 this month, sorted by date desc)
  const recentRuns = useMemo(
    () =>
      [...thisMonthRuns]
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        )
        .slice(0, 8),
    [thisMonthRuns],
  );

  // ── Render ───────────────────────────────────────────────────────

  const unitLabel = unit === "mi" ? "mi" : "km";
  const paceLabel = unit === "mi" ? "/mi" : "/km";

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* This Week */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            This Week
          </span>
          <div className="mt-2 font-[family-name:var(--font-mono)] text-[26px] font-medium tracking-tight tabular-nums text-[var(--ink)]">
            {toDisplayDistance(thisWeekDist, unit)}{" "}
            <span className="text-[14px] text-[var(--ink-3)]">{unitLabel}</span>
          </div>
          <span className="text-[12px] text-[var(--ink-3)]">
            {pctChange(thisWeekDist, lastWeekDist)} vs last week
          </span>
        </div>

        {/* Avg Pace */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Avg Pace
          </span>
          <div className="mt-2 font-[family-name:var(--font-mono)] text-[26px] font-medium tracking-tight tabular-nums text-[var(--ink)]">
            {formatPace(avgPaceThis)}{" "}
            <span className="text-[14px] text-[var(--ink-3)]">{paceLabel}</span>
          </div>
          <span className="text-[12px] text-[var(--ink-3)]">
            {avgPaceLast > 0
              ? pctChange(avgPaceThis, avgPaceLast) + " vs last month"
              : "no data last month"}
          </span>
        </div>

        {/* Longest */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Longest
          </span>
          <div className="mt-2 font-[family-name:var(--font-mono)] text-[26px] font-medium tracking-tight tabular-nums text-[var(--ink)]">
            {longestRun
              ? `${toDisplayDistance(longestRun.distanceMeters, unit)} ${unitLabel}`
              : "—"}
          </div>
          <span className="text-[12px] text-[var(--ink-3)] truncate block">
            {longestRun?.name ?? "No runs this month"}
          </span>
        </div>

        {/* New PRs */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            New PRs
          </span>
          <div className="mt-2 font-[family-name:var(--font-mono)] text-[26px] font-medium tracking-tight tabular-nums text-[var(--accent)]">
            {prCountMonth}
          </div>
          <span className="text-[12px] text-[var(--ink-3)]">this month</span>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Weekly Distance Bar Chart */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Weekly distance &middot; 12w
          </span>
          <svg
            viewBox="0 0 360 140"
            className="mt-3 w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {weeklyBuckets.map((bucket, i) => {
              const barW = 22;
              const gap = (360 - barW * 12) / 13;
              const x = gap + i * (barW + gap);
              const barH = (bucket.value / maxWeeklyDist) * 100;
              const y = 120 - barH;
              const isLatest = i === 11;
              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={barW}
                    height={barH}
                    rx={4}
                    fill={isLatest ? "var(--accent)" : "#d6cfbc"}
                  />
                  <text
                    x={x + barW / 2}
                    y={135}
                    textAnchor="middle"
                    fontSize="7"
                    fill="var(--ink-4)"
                    fontFamily="var(--font-mono)"
                  >
                    {bucket.label}
                  </text>
                </g>
              );
            })}
            {/* Baseline */}
            <line
              x1="0"
              y1="120"
              x2="360"
              y2="120"
              stroke="var(--line)"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Avg Pace Line Chart */}
        <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] p-4">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Avg pace &middot; 90d
          </span>
          <svg
            viewBox="0 0 360 140"
            className="mt-3 w-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {pacePoints.length > 1 && (
              <>
                <defs>
                  <linearGradient
                    id="paceGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="var(--accent)"
                      stopOpacity="0.2"
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--accent)"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
                {/* Area fill */}
                <path
                  d={
                    pacePoints
                      .map((p, i) => {
                        const x = (p.week / 12) * 340 + 10;
                        // Invert: lower pace = higher on chart (faster)
                        const y =
                          120 -
                          ((paceMax - p.pace) / (paceMax - paceMin)) * 100;
                        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                      })
                      .join(" ") +
                    ` L ${(pacePoints[pacePoints.length - 1].week / 12) * 340 + 10} 120 L ${(pacePoints[0].week / 12) * 340 + 10} 120 Z`
                  }
                  fill="url(#paceGradient)"
                />
                {/* Line */}
                <polyline
                  points={pacePoints
                    .map((p) => {
                      const x = (p.week / 12) * 340 + 10;
                      const y =
                        120 -
                        ((paceMax - p.pace) / (paceMax - paceMin)) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {pacePoints.map((p, i) => {
                  const x = (p.week / 12) * 340 + 10;
                  const y =
                    120 - ((paceMax - p.pace) / (paceMax - paceMin)) * 100;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="3"
                      fill="var(--accent)"
                    />
                  );
                })}
              </>
            )}
            {pacePoints.length <= 1 && (
              <text
                x="180"
                y="70"
                textAnchor="middle"
                fontSize="11"
                fill="var(--ink-4)"
              >
                Not enough data
              </text>
            )}
            <line
              x1="0"
              y1="120"
              x2="360"
              y2="120"
              stroke="var(--line)"
              strokeWidth="1"
            />
          </svg>
        </div>
      </div>

      {/* Recent Runs Table */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)]">
          <span className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest text-[var(--ink-4)]">
            Recent Runs
          </span>
          <span className="text-[12px] text-[var(--accent)] cursor-pointer hover:underline">
            View all &rarr;
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--card-2)] text-[var(--ink-4)] text-left">
                <th className="px-4 py-2 font-medium">Activity</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium text-right">Distance</th>
                <th className="px-4 py-2 font-medium text-right">Time</th>
                <th className="px-4 py-2 font-medium text-right">Pace</th>
                <th className="px-4 py-2 font-medium text-right">Avg HR</th>
                <th className="px-4 py-2 font-medium text-right">Cadence</th>
                <th className="px-4 py-2 font-medium text-center">PR</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-[var(--line)] hover:bg-[var(--bg-2)] transition-colors"
                >
                  <td className="px-4 py-2.5 flex items-center gap-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
                    <span className="truncate max-w-[180px]">{run.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-[var(--ink-3)] whitespace-nowrap">
                    {new Date(run.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {toDisplayDistance(run.distanceMeters, unit)} {unitLabel}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {formatDuration(run.movingTime)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {formatPace(paceForUnit(run.avgSpeed, unit))} {paceLabel}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {run.avgHr !== null ? run.avgHr : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-[family-name:var(--font-mono)] tabular-nums">
                    {run.cadence !== null ? run.cadence : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {run.prCount > 0 ? (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-medium">
                        {run.prCount} PR
                      </span>
                    ) : (
                      <span className="text-[var(--ink-4)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {recentRuns.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-8 text-center text-[var(--ink-4)]"
                  >
                    No runs this month
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
