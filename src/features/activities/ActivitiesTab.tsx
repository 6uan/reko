import { useState, useMemo } from "react";
import {
  speedToPaceSeconds,
  formatPace,
  formatDuration,
} from "../../lib/strava";
import {
  activityKind,
  KM_PER_MI,
  toDisplayDistance,
  type DashboardRun,
  type Unit,
} from "../../lib/activities";

type Props = {
  /** Full list — runs + walks. The sport-type toggle below filters
   *  this down before the intensity chips apply. */
  activities: DashboardRun[];
  unit: Unit;
};

// ── Helpers ────────────────────────────────────────────────────────

function paceForUnit(speedMs: number, unit: Unit): number {
  if (speedMs <= 0) return 0;
  if (unit === "mi") return KM_PER_MI / speedMs;
  return speedToPaceSeconds(speedMs);
}

// ── Filter definitions ─────────────────────────────────────────────

type SportFilter = "all" | "run" | "walk";

const SPORT_FILTERS: { key: SportFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "run", label: "Runs" },
  { key: "walk", label: "Walks" },
];

function applySportFilter(
  activities: DashboardRun[],
  sport: SportFilter,
): DashboardRun[] {
  if (sport === "all") return activities;
  return activities.filter((a) => activityKind(a) === sport);
}

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
  unit: Unit,
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

export default function Activities({ activities, unit }: Props) {
  // Default to "All" so the user sees both runs and walks immediately
  // (the whole reason walks were brought in). Sport filter applies first;
  // intensity chips compose on top of the sport-filtered set.
  const [sportFilter, setSportFilter] = useState<SportFilter>("all");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [sortCol, setSortCol] = useState<SortCol>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Sport filter (run/walk/all) — applied first so subsequent stages
  // operate on the smaller set.
  const bySport = useMemo(
    () => applySportFilter(activities, sportFilter),
    [activities, sportFilter],
  );

  // Filter to last 30 days
  const last30 = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return bySport.filter((r) => new Date(r.date) >= cutoff);
  }, [bySport]);

  const filtered = useMemo(
    () => applyFilter(last30, activeFilter),
    [last30, activeFilter],
  );

  const sorted = useMemo(
    () => sortRuns(filtered, sortCol, sortDir, unit),
    [filtered, sortCol, sortDir, unit],
  );

  // Header copy reflects the current sport scope. "Activities" when "All"
  // is selected, "Runs" / "Walks" when narrowed — keeps the count line
  // semantically correct without juggling pluralization rules per sport.
  const sportLabel =
    sportFilter === "run" ? "run" : sportFilter === "walk" ? "walk" : "activity";
  const sportLabelPlural =
    sportFilter === "run" ? "runs" : sportFilter === "walk" ? "walks" : "activities";
  const countWord = last30.length === 1 ? sportLabel : sportLabelPlural;

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
      case "name": {
        // Color-code the dot so walks are distinguishable at a glance
        // without introducing a whole extra column. Accent = run, muted
        // = walk, keeps the table dense.
        const k = activityKind(run);
        const dotClass =
          k === "run"
            ? "bg-[var(--accent)]"
            : k === "walk"
              ? "bg-[var(--ink-4)]"
              : "bg-[var(--ink-4)] opacity-60";
        return (
          <span className="flex items-center gap-2">
            <span
              className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotClass}`}
              title={k === "walk" ? "Walk" : k === "run" ? "Run" : "Other"}
            />
            <span className="truncate max-w-50">{run.name}</span>
          </span>
        );
      }
      case "date":
        return (
          <span className="text-(--ink-3) whitespace-nowrap">
            {new Date(run.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        );
      case "distance":
        return (
          <span className="font-mono tabular-nums">
            {toDisplayDistance(run.distanceMeters, unit)} {unitLabel}
          </span>
        );
      case "time":
        return (
          <span className="font-mono tabular-nums">
            {formatDuration(run.movingTime)}
          </span>
        );
      case "pace":
        return (
          <span className="font-mono tabular-nums">
            {formatPace(paceForUnit(run.avgSpeed, unit))} {paceLabel}
          </span>
        );
      case "avgHr":
        return (
          <span className="font-mono tabular-nums">
            {run.avgHr !== null ? run.avgHr : "\u2014"}
          </span>
        );
      case "maxHr":
        return (
          <span className="font-mono tabular-nums">
            {run.maxHr !== null ? run.maxHr : "\u2014"}
          </span>
        );
      case "cadence":
        return (
          <span className="font-mono tabular-nums">
            {run.cadence !== null ? run.cadence : "\u2014"}
          </span>
        );
      case "elevation":
        return (
          <span className="font-mono tabular-nums">
            {Math.round(run.elevation)}m
          </span>
        );
      case "pr":
        return run.prCount > 0 ? (
          <span className="inline-block px-2 py-0.5 rounded-full bg-(--accent-soft) text-(--accent) text-[11px] font-medium">
            {run.prCount} PR
          </span>
        ) : (
          <span className="text-(--ink-4)">{"\u2014"}</span>
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
          <h2 className="font-(family-name:--font-head) text-[24px] font-semibold text-(--ink)">
            Activities
          </h2>
          <p className="text-[13px] text-(--ink-3) mt-1">
            {last30.length} {countWord} &middot; last 30 days
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-[12px] rounded-lg border border-(--line) bg-(--card) text-(--ink-3) hover:text-(--ink) transition-colors"
          >
            Filter
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-[12px] rounded-lg border border-(--line) bg-(--card) text-(--ink-3) hover:text-(--ink) transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Sport-type toggle (segmented). Separate from the intensity
          chips below because it's a different filter axis: this picks
          which sport to show, the chips refine within that sport. */}
      <div className="inline-flex p-0.75 bg-(--card-2) border border-(--line) rounded-[9px] font-mono text-[11px] font-medium self-start">
        {SPORT_FILTERS.map((s) => {
          const isActive = s.key === sportFilter;
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setSportFilter(s.key)}
              className={`px-2.5 py-1.25 rounded-md cursor-pointer transition-colors ${
                isActive
                  ? "bg-(--ink) text-(--bg)"
                  : "text-(--ink-3) bg-transparent"
              }`}
            >
              {s.label}
            </button>
          );
        })}
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
                  ? "bg-(--ink) text-(--bg)"
                  : "bg-(--card) border border-(--line) text-(--ink-3) hover:text-(--ink)"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Sortable Table */}
      <div className="bg-(--card) border border-(--line) rounded-[14px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-(--card-2) text-(--ink-4) text-left">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-2 font-medium cursor-pointer select-none hover:text-(--ink-2) transition-colors whitespace-nowrap ${alignClass(col.align)}`}
                  >
                    {col.label}
                    {sortCol === col.key && (
                      <span className="ml-1 text-(--accent)">
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
                  className="border-t border-(--line) hover:bg-(--bg-2) transition-colors"
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
                    className="px-4 py-8 text-center text-(--ink-4)"
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
