import { useMemo } from "react";
import { useLocation } from "@tanstack/react-router";
import { useDashboard } from "./DashboardContext";
import { rangeOptionsForYears, yearsInData, type RangeKey } from "./range";
import { TABS, isTabActive } from "./tabs";
import IconButton from "@/components/ui/IconButton";
import type { Unit } from "@/lib/activities";
import { HiViewGridAdd } from "react-icons/hi";

export default function Topbar({
  onOpenMobileNav,
}: {
  onOpenMobileNav: () => void;
}) {
  const { unit, toggleUnit, range, setRange, allActivities } = useDashboard();
  const pathname = useLocation({ select: (l) => l.pathname });

  const activeTab = TABS.find((t) => isTabActive(t, pathname)) ?? TABS[0];
  const years = useMemo(() => yearsInData(allActivities), [allActivities]);
  const rangeOptions = useMemo(() => rangeOptionsForYears(years), [years]);

  const UnitBtn = ({ value }: { value: Unit }) => (
    <button
      onClick={() => toggleUnit(value)}
      className={`px-2.5 py-1.5 rounded-(--radius-s) cursor-pointer transition-colors ${
        unit === value
          ? "bg-(--ink) text-(--bg)"
          : "text-(--ink-3) bg-transparent"
      }`}
    >
      {value}
    </button>
  );

  return (
    <div className="sticky top-0 z-30 bg-(--bg)/80 backdrop-blur-xl border-b border-(--line) px-4 lg:px-7 py-3.5 flex items-center justify-between">
      <div className="flex items-center gap-3 font-mono text-xs text-(--ink-3)">
        <IconButton
          onClick={onOpenMobileNav}
          aria-label="Open navigation"
          className="lg:hidden"
        >
          <HiViewGridAdd size={18} />
        </IconButton>
        <strong className="text-(--ink) font-medium">{activeTab.label}</strong>
      </div>
      <div className="flex items-center gap-2.5">
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-(--card) border border-(--line) rounded-(--radius-s) font-mono text-xs text-(--ink-3)">
          <svg
            width="11"
            height="11"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          Search runs
          <span className="text-(--ink-4) ml-1.5">⌘K</span>
        </div>
        <div className="relative">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as RangeKey)}
            aria-label="Time range"
            className="appearance-none pl-2.5 pr-7 py-1.5 bg-(--card) border border-(--line) rounded-(--radius-s) font-mono text-xs text-(--ink-3) cursor-pointer focus:outline-none"
          >
            {rangeOptions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
          <svg
            width="12"
            height="7"
            viewBox="0 0 12 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-(--ink-3)"
          >
            <path d="M1 1l5 5 5-5" />
          </svg>
        </div>
        <div className="inline-flex p-1 bg-(--card-2) border border-(--line) rounded-(--radius-s) text-detail font-medium">
          <UnitBtn value="km" />
          <UnitBtn value="mi" />
        </div>
      </div>
    </div>
  );
}
