import { useState, useMemo } from "react";
import {
  speedToPaceSeconds,
  formatPace,
  formatDistanceKm,
  formatDuration,
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

// ── Filter definitions ─────────────────────────────────────────────

type FilterKey = "all" | "has_pr" | "10km" | "tempo" | "easy";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "has_pr", label: "Has PR" },
  { key: "10km", label: "10 km+" },
  { key: "tempo", label: "Tempo+" },
  { key: "easy", label: "Easy" },
];

function applyFilter(runs: DashboardRun[], filter: FilterKey): DashboardRun[] {
  switch (filter) {
    case "has_pr":
      return runs.filter((r) => r.prCount > 0);
    case "10km":
      return runs.filter((r) => r.distanceMeters >= 10_000);
    case "tempo":
      return runs.filter((r) => r.avgHr !== null && r.avgHr >= 155);
    case "easy":
      return runs.filter((r) => r.avgHr !== null && r.avgHr < 150);
    default:
      return runs;
  }
}

// ── Sort definitions ───────────────────────────────────────────────

type SortCol =
  | "name"
  | "date"
  | "distance"
  | "time"
  | "pace"
  | "avgHr"
  | "maxHr"
  | "cadence"
  | "elevation"
  | "pr";

type SortDir = "asc" | "desc";

function sortRuns(
  runs: DashboardRun[],
  col: SortCol,
  dir: SortDir,
  unit: "km" | "mi",
): DashboardRun[] {
  const sorted = [...runs];
  const mult = dir === "asc" ? 1 : -1;

  sorted.sort((a, b) => {
    switch (col) {
      case "name":
        return mult * a.name.localeCompare(b.name);
      case "date":
        return (
          mult *
          (new Date(a.date).getTime() - new Date(b.date).getTime())
        );
      case "distance":
        return mult * (a.distanceMeters - b.distanceMeters);
      case "time":
        return mult * (a.movingTime - b.movingTime);
      case "pace":
        return (
          mult * (paceForUnit(a.avgSpeed, unit) - paceForUnit(b.avgSpeed, unit))
        );
      case "avgHr":
        return mult * ((a.avgHr ?? 0) - (b.avgHr ?? 0));
      case "maxHr":
        return mult * ((a.maxHr ?? 0) - (b.maxHr ?? 0));
      case "cadence":
        return mult * ((a.cadence ?? 0) - (b.cadence ?? 0));
      case "elevation":
        return mult * (a.elevation - b.elevation);
      case "pr":
        return mult * (a.prCount - b.prCount);
      default:
        return 0;
    }
  });

  return sorted;
}

// ── Column config ──────────────────────────────────────────────────

type ColDef = {
  key: SortCol;
  label: string;
  align: "left" | "right" | "center";
};

const COLUMNS: ColDef[] = [
  { key: "name", label: "Activity", align: "left" },
  { key: "date", label: "Date", align: "left" },
  { key: "distance", label: "Distance", align: "right" },
  { key: "time", label: "Time", align: "right" },
  { key: "pace", label: "Pace", align: "right" },
  { key: "avgHr", label: "Avg HR", align: "right" },
  { key: "maxHr", label: "Max HR", align: "right" },
  { key: "cadence", label: "Cadence", align: "right" },
  { key: "elevation", label: "Elev", align: "right" },
  { key: "pr", label: "PR", align: "center" },
];

// ── Component ──────────────────────────────────────────────────────

export default function Activities({ runs, unit }: Props) {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filter to last 30 days
  const last30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return runs.filter((r) => new Date(r.date) >= cutoff);
  }, [runs]);

  const filtered = useMemo(
    () => applyFilter(last30, activeFilter),
    [last30, activeFilter],
  );

  const sorted = useMemo(
    () => sortRuns(filtered, sortCol, sortDir, unit),
    [filtered, sortCol, sortDir, unit],
  );

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  const unitLabel = unit === "mi" ? "mi" : "km";
  const paceLabel = unit === "mi" ? "/mi" : "/km";

  function renderCell(run: DashboardRun, col: SortCol) {
    switch (col) {
      case "name":
        return (
          <span className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
            <span className="truncate max-w-[200px]">{run.name}</span>
          </span>
        );
      case "date":
        return (
          <span className="text-[var(--ink-3)] whitespace-nowrap">
            {new Date(run.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        );
      case "distance":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {toDisplayDistance(run.distanceMeters, unit)} {unitLabel}
          </span>
        );
      case "time":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {formatDuration(run.movingTime)}
          </span>
        );
      case "pace":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {formatPace(paceForUnit(run.avgSpeed, unit))} {paceLabel}
          </span>
        );
      case "avgHr":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {run.avgHr !== null ? run.avgHr : "\u2014"}
          </span>
        );
      case "maxHr":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {run.maxHr !== null ? run.maxHr : "\u2014"}
          </span>
        );
      case "cadence":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {run.cadence !== null ? run.cadence : "\u2014"}
          </span>
        );
      case "elevation":
        return (
          <span className="font-[family-name:var(--font-mono)] tabular-nums">
            {Math.round(run.elevation)}m
          </span>
        );
      case "pr":
        return run.prCount > 0 ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] text-[11px] font-medium">
            {run.prCount} PR
          </span>
        ) : (
          <span className="text-[var(--ink-4)]">{"\u2014"}</span>
        );
      default:
        return null;
    }
  }

  const alignClass = (align: "left" | "right" | "center") =>
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";

  return (
    <div className="flex flex-col gap-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-[family-name:var(--font-head)] text-[24px] font-semibold text-[var(--ink)]">
            Activities
          </h2>
          <p className="text-[13px] text-[var(--ink-3)] mt-1">
            {last30.length} run{last30.length !== 1 ? "s" : ""} &middot; last 30
            days
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--line)] bg-[var(--card)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Filter
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--line)] bg-[var(--card)] text-[var(--ink-3)] hover:text-[var(--ink)] transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f.key === activeFilter;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setActiveFilter(f.key)}
              className={`px-3 py-1.5 text-[12px] rounded-full transition-colors ${
                isActive
                  ? "bg-[var(--ink)] text-white"
                  : "bg-[var(--card)] border border-[var(--line)] text-[var(--ink-3)] hover:text-[var(--ink)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Sortable Table */}
      <div className="bg-[var(--card)] border border-[var(--line)] rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-[var(--card-2)] text-[var(--ink-4)] text-left">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-[var(--ink-2)] transition-colors whitespace-nowrap ${alignClass(col.align)}`}
                  >
                    {col.label}
                    {sortCol === col.key && (
                      <span className="ml-1 text-[var(--accent)]">
                        {sortDir === "asc" ? "\u2191" : "\u2193"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((run) => (
                <tr
                  key={run.id}
                  className="border-t border-[var(--line)] hover:bg-[var(--bg-2)] transition-colors"
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className={`px-4 py-2.5 ${alignClass(col.align)}`}
                    >
                      {renderCell(run, col.key)}
                    </td>
                  ))}
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-8 text-center text-[var(--ink-4)]"
                  >
                    No activities match this filter
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
