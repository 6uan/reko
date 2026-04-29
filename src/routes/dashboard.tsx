import { useCallback, useMemo, useState } from "react";
import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSession as frameworkGetSession } from "@tanstack/react-start/server";
import { sessionConfig, type SessionData } from "../features/auth/session";
import { enqueueBackfill } from "../features/sync/backfillActivities.server";
import { getActivities } from "../features/activities/getActivities.server";
import { getLastSyncTime } from "../features/sync/getLastSyncTime.server";
import { getRecordsData } from "../features/records/getRecordsData.server";
import { useLiveUpdates } from "../features/sync/useLiveUpdates";
import SyncBanner from "../features/sync/SyncBanner";
import ProfileCard from "../ui/ProfileCard";
import IconButton from "../ui/IconButton";
import { useBodyScrollLock } from "../lib/useBodyScrollLock";
import { useEscapeKey } from "../lib/useEscapeKey";
import { activityKind, type Unit } from "../lib/activities";
import {
  LuLayoutDashboard,
  LuList,
  LuCircleGauge,
  LuHeartPulse,
} from "react-icons/lu";
import { FaPersonRunning } from "react-icons/fa6";
import { FaTrophy } from "react-icons/fa";
import { HiOutlineXMark } from "react-icons/hi2";
import { HiViewGridAdd } from "react-icons/hi";
import type { IconType } from "react-icons";

import OverviewTab from "../features/overview/OverviewTab";
import ActivitiesTab from "../features/activities/ActivitiesTab";
import PaceTab from "../features/pace/PaceTab";
import HeartRateTab from "../features/heart-rate/HeartRateTab";
import CadenceTab from "../features/cadence/CadenceTab";
import RecordsTab from "../features/records/RecordsTab";

// ── Data loading ───────────────────────────────────────────────────

const loadDashboardData = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await frameworkGetSession<SessionData>(sessionConfig);
    const d = session.data;
    if (!d.userId) throw redirect({ to: "/" });

    const [activities, records, lastSyncFinishedAt] = await Promise.all([
      getActivities(d.userId),
      getRecordsData(d.userId),
      getLastSyncTime(d.userId),
    ]);

    // First-login backfill: if nothing cached, enqueue a sync. The
    // function handles the "already running" idempotency check itself,
    // so this is safe to call on every load when nothing has been synced.
    if (activities.length === 0) {
      await enqueueBackfill(d.userId).catch((err) => {
        console.error("[backfill] enqueue failed:", err);
      });
    }

    return {
      activities,
      records,
      athlete: {
        firstname: d.firstname,
        lastname: d.lastname,
        profile: d.profile,
      },
      lastSyncFinishedAt,
    };
  },
);

// ── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute("/dashboard")({
  beforeLoad: async ({ context }) => {
    if (!context.session) throw redirect({ to: "/" });
  },
  loader: () => loadDashboardData(),
  component: Dashboard,
});

// ── Tab definitions ────────────────────────────────────────────────

type TabId =
  | "overview"
  | "activities"
  | "pace"
  | "heart"
  | "cadence"
  | "records";

const TABS: { id: TabId; icon: IconType; label: string }[] = [
  { id: "overview", icon: LuLayoutDashboard, label: "Overview" },
  { id: "activities", icon: LuList, label: "Activities" },
  { id: "pace", icon: LuCircleGauge, label: "Pace" },
  { id: "heart", icon: LuHeartPulse, label: "Heart rate" },
  { id: "cadence", icon: FaPersonRunning, label: "Cadence" },
  { id: "records", icon: FaTrophy, label: "Personal records" },
];

// ── Dashboard component ────────────────────────────────────────────

function Dashboard() {
  const {
    activities: dashboardActivities,
    records,
    athlete,
    lastSyncFinishedAt: initialFinishedAt,
  } = Route.useLoaderData();

  // Analytics tabs (Overview, Pace, HR, Cadence, Records) only make
  // sense for runs — walking HR/cadence/pace are bimodal vs running and
  // would muddy the charts. ActivitiesTab gets the full set + a toggle.
  const runs = useMemo(
    () => dashboardActivities.filter((a) => activityKind(a) === "run"),
    [dashboardActivities],
  );

  // Live updates: opens an SSE stream to /api/sync/stream and invalidates
  // this route whenever a background worker publishes an activity-changed
  // event (webhook from Strava, detail-fetch progress, backfill done).
  // See src/features/sync/useLiveUpdates.ts for the wiring details.
  useLiveUpdates();

  const [tab, setTab] = useState<TabId>("overview");
  const [unit, setUnit] = useState<Unit>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("reko-unit") as Unit) || "mi";
    }
    return "mi";
  });

  // Bumped on every Resync click → forces SyncBanner to remount and
  // restart polling, so it picks up the freshly-enqueued sync_log row.
  const [syncTriggerKey, setSyncTriggerKey] = useState(0);

  // Drives the ResyncButton's cooldown ring. Seeded from the loader so
  // it's correct on page load, then updated by SyncBanner's
  // onSyncCompleted callback whenever a sync finishes in this session.
  const [lastSyncFinishedAt, setLastSyncFinishedAt] = useState<Date | null>(
    () => (initialFinishedAt ? new Date(initialFinishedAt) : null),
  );

  const toggleUnit = (u: Unit) => {
    setUnit(u);
    if (typeof window !== "undefined") localStorage.setItem("reko-unit", u);
  };

  // Mobile nav drawer — fullscreen overlay triggered by the HiViewGridAdd
  // icon in the topbar. Hidden entirely on lg+ since the desktop sidebar
  // covers nav there.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useBodyScrollLock(mobileNavOpen);
  useEscapeKey(
    mobileNavOpen,
    useCallback(() => setMobileNavOpen(false), []),
  );

  // Tab pick that also closes the drawer — wired to both the desktop
  // sidebar buttons (no-op for the close, drawer never opens on lg+)
  // and the mobile grid tiles.
  const selectTab = (id: TabId) => {
    setTab(id);
    setMobileNavOpen(false);
  };

  const activeTab = TABS.find((t) => t.id === tab)!;

  const handleResync = useCallback(() => setSyncTriggerKey((k) => k + 1), []);

  // Inline sub-component for the unit toggle buttons (km / mi)
  const UnitBtn = ({ value }: { value: Unit }) => (
    <button
      onClick={() => toggleUnit(value)}
      className={`px-2.5 py-1.25 rounded-md cursor-pointer transition-colors ${
        unit === value
          ? "bg-(--ink) text-(--bg)"
          : "text-(--ink-3) bg-transparent"
      }`}
    >
      {value}
    </button>
  );

  return (
    <div className="min-h-screen bg-(--bg)">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-60 bg-(--bg-2) border-r border-(--line) flex flex-col z-40 max-lg:hidden">
        {/* Brand — Tilt Warp wordmark, identical to the home Header so
            the brand identity travels between marketing and app surfaces.
            Same `font-display text-[32px] leading-none` recipe as
            `src/ui/Header.tsx`; if you tweak one, update the other. */}
        <div className="px-5 py-5">
          <Link
            to="/"
            className="font-display text-[32px] leading-none text-(--ink) no-underline"
          >
            Reko
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 mt-2">
          <p className="px-3 mb-3 font-mono text-[11px] uppercase tracking-widest text-(--ink-4)">
            Training
          </p>
          <div className="flex flex-col gap-1">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition-colors cursor-pointer ${
                  tab === id
                    ? "bg-(--card) text-(--ink) font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-(--line)"
                    : "text-(--ink-2) hover:bg-[rgba(0,0,0,0.04)] hover:text-(--ink) border border-transparent"
                }`}
              >
                <Icon
                  size={18}
                  className={tab === id ? "text-(--accent)" : "opacity-60"}
                />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Profile + Resync */}
        <ProfileCard
          firstname={athlete.firstname}
          lastname={athlete.lastname}
          activityCount={dashboardActivities.length}
          lastSyncFinishedAt={lastSyncFinishedAt}
          onResyncTriggered={handleResync}
          className="mx-3 mb-3.5"
        />
      </aside>

      {/* Main content */}
      <main className="lg:ml-60">
        {/* Sync status banner (auto-hides when nothing to show).
            Keyed by syncTriggerKey so each Resync click remounts it and
            restarts polling against the new sync_log row. */}
        <SyncBanner
          key={syncTriggerKey}
          currentRunCount={runs.length}
          onSyncCompleted={(finishedAt) => setLastSyncFinishedAt(finishedAt)}
        />

        {/* Topbar */}
        <div className="sticky top-0 z-30 bg-(--bg)/80 backdrop-blur-xl border-b border-(--line) px-4 lg:px-7 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 font-mono text-[12px] text-(--ink-3)">
            {/* Mobile nav trigger — only visible below lg, where the
                desktop sidebar is hidden. Sits at top-left as requested. */}
            <IconButton
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden"
            >
              <HiViewGridAdd size={18} />
            </IconButton>
            <strong className="text-(--ink) font-medium">
              {activeTab.label}
            </strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-(--card) border border-(--line) rounded-lg font-mono text-[12px] text-(--ink-3)">
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
            <div className="inline-flex p-0.75 bg-(--card-2) border border-(--line) rounded-[9px] font-mono text-[11px] font-medium">
              <UnitBtn value="km" />
              <UnitBtn value="mi" />
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 lg:p-7 flex flex-col gap-6 min-w-0">
          {tab === "overview" && <OverviewTab runs={runs} unit={unit} />}
          {tab === "activities" && (
            <ActivitiesTab activities={dashboardActivities} unit={unit} />
          )}
          {tab === "pace" && <PaceTab runs={runs} unit={unit} />}
          {tab === "heart" && <HeartRateTab runs={runs} unit={unit} />}
          {tab === "cadence" && <CadenceTab runs={runs} unit={unit} />}
          {tab === "records" && (
            <RecordsTab data={records} runs={runs} unit={unit} />
          )}
        </div>
      </main>

      {/* ── Mobile nav drawer ──────────────────────────────────────────
          Fullscreen overlay, lg:hidden so it's literally absent on
          desktop (no DOM cost). Mounts when mobileNavOpen is true.
          Tile click → selectTab() (sets tab + closes drawer in one go).
          User card at the bottom mirrors the desktop sidebar's footer
          so familiarity carries between viewports. */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-(--bg) flex flex-col">
          {/* Drawer header — close button sits in the same spot as the
              grid icon that opened the drawer so the tap target stays put. */}
          <div className="flex items-center px-4 py-3.5 border-b border-(--line)">
            <IconButton
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
            >
              <HiOutlineXMark size={18} />
            </IconButton>
          </div>

          {/* Tab grid — 2 columns, bold labels per the user's spec.
              Each tile is a button so keyboard / a11y just works. */}
          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-(--ink-4) mb-3 px-1">
              Training
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TABS.map(({ id, icon: Icon, label }) => {
                const isActive = tab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={`flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-colors ${
                      isActive
                        ? "bg-(--card) border-(--accent) shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                        : "bg-(--card) border-(--line) hover:bg-(--card-2)"
                    }`}
                  >
                    <Icon
                      size={22}
                      className={
                        isActive ? "text-(--accent)" : "text-(--ink-3)"
                      }
                    />
                    <span className="text-[15px] font-bold text-(--ink) leading-tight">
                      {label}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Bottom actions — Home link + user card */}
          <div className="mx-4 mb-2">
            <Link
              to="/"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] text-[13px] font-medium text-(--ink-2) no-underline hover:bg-(--card) hover:text-(--ink)   transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Back to home
            </Link>
          </div>
          <ProfileCard
            firstname={athlete.firstname}
            lastname={athlete.lastname}
            activityCount={dashboardActivities.length}
            lastSyncFinishedAt={lastSyncFinishedAt}
            onResyncTriggered={handleResync}
            onNavigate={() => setMobileNavOpen(false)}
            className="mx-4 mb-4"
          />
        </div>
      )}
    </div>
  );
}
