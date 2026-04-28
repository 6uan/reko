import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import { and, desc, eq, or } from 'drizzle-orm'
import { getDb } from '../db/client'
import { activities, syncLog } from '../db/schema'
import { sessionConfig, type SessionData } from '../features/auth/session'
import { enqueueBackfill } from '../features/sync/backfillActivities'
import ResyncButton from '../features/sync/ResyncButton'
import { useLiveUpdates } from '../features/sync/useLiveUpdates'
import { Avatar } from '../ui/Avatar'
import SyncBanner from '../features/sync/SyncBanner'
import {
  LayoutDashboard,
  List,
  Gauge,
  Heart,
  Footprints,
  Trophy,
  X,
} from 'lucide-react'
import { HiViewGridAdd } from 'react-icons/hi'

import OverviewTab from '../features/overview/OverviewTab'
import ActivitiesTab from '../features/activities/ActivitiesTab'
import PaceTab from '../features/pace/PaceTab'
import HeartRateTab from '../features/heart-rate/HeartRateTab'
import CadenceTab from '../features/cadence/CadenceTab'
import RecordsTab from '../features/records/RecordsTab'
import { getRecordsData } from '../features/records/getRecordsData'

// ── Types ──────────────────────────────────────────────────────────

export type DashboardRun = {
  id: number
  name: string
  /** Strava's legacy sport field — always populated. e.g. 'Run', 'Walk', 'Ride'. */
  type: string
  /** Strava's modern, more granular sport_type — nullable for older activities.
   *  e.g. 'Run', 'TrailRun', 'VirtualRun', 'Walk'. */
  sportType: string | null
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

/**
 * Classify an activity for UI grouping. Strava's `type` is legacy and
 * coarse ('Run', 'Walk'), `sport_type` is granular ('Run', 'TrailRun',
 * 'VirtualRun', 'Walk', 'NordicWalk'). Treat any *Run* sport_type as a
 * run and any *Walk* sport_type as a walk; fall back to `type` when
 * sport_type is null (older activities pre-dating the sport_type field).
 */
export function activityKind(a: Pick<DashboardRun, 'type' | 'sportType'>):
  | 'run'
  | 'walk'
  | 'other' {
  const sport = a.sportType ?? a.type
  if (sport === 'Run' || sport === 'TrailRun' || sport === 'VirtualRun') return 'run'
  if (sport === 'Walk' || sport === 'NordicWalk') return 'walk'
  return 'other'
}

// ── Data loading ───────────────────────────────────────────────────

const loadDashboardData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await frameworkGetSession<SessionData>(sessionConfig)
    const d = session.data
    if (!d.userId) throw redirect({ to: '/' })

    const db = getDb()

    // Read all runs + walks from the DB cache. Strava splits type
    // (legacy, coarse) from sport_type (modern, granular) — match either
    // for both Run and Walk to catch TrailRun/VirtualRun/NordicWalk
    // variants. Other sport types (Ride, Hike, Workout, …) are excluded
    // — Reko is a running dashboard with walks added as a secondary view,
    // not a general activity tracker.
    const dbRuns = await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, d.userId),
          or(
            eq(activities.type, 'Run'),
            eq(activities.sportType, 'Run'),
            eq(activities.type, 'Walk'),
            eq(activities.sportType, 'Walk'),
          ),
        ),
      )
      .orderBy(desc(activities.startDate))

    const dashboardActivities: DashboardRun[] = dbRuns.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      sportType: a.sportType,
      // startDateLocal is "YYYY-MM-DD HH:MM:SS" (wall-clock string).
      // Convert to ISO-style "YYYY-MM-DDTHH:MM:SSZ" so consumers' new Date()
      // parses consistently across browsers.
      date: a.startDateLocal.replace(' ', 'T') + 'Z',
      distanceMeters: a.distance,
      movingTime: a.movingTime,
      avgSpeed: a.averageSpeed ?? 0,
      avgHr: a.averageHeartrate,
      maxHr: a.maxHeartrate,
      cadence: a.averageCadence ? Math.round(a.averageCadence * 2) : null,
      elevation: a.totalElevationGain,
      prCount: a.prCount,
    }))

    // First-login backfill: if nothing cached, enqueue a sync. The
    // function handles the "already running" idempotency check itself,
    // so this is safe to call on every load when nothing has been synced.
    // Awaited (not fire-and-forget) so the sync_log row is committed
    // before the response — the SyncBanner's first poll then sees it.
    if (dashboardActivities.length === 0) {
      await enqueueBackfill(d.userId).catch((err) => {
        console.error('[backfill] enqueue failed:', err)
      })
    }

    // Most recent sync's finishedAt → seeds the ResyncButton's cooldown
    // ring on page load so the button is correctly disabled if the user
    // refreshes within the cooldown window. null when no sync has ever
    // completed (or current latest is still running).
    const [latestSync] = await db
      .select({ finishedAt: syncLog.finishedAt })
      .from(syncLog)
      .where(eq(syncLog.userId, d.userId))
      .orderBy(desc(syncLog.startedAt))
      .limit(1)

    // Best-efforts-derived per-distance PR data for the Records tab.
    // Cheap (one indexed query joined to activities); keeping it in the
    // single loader so client doesn't waterfall on tab switch.
    const records = await getRecordsData(d.userId)

    return {
      // Loader returns the full set (runs + walks). The Dashboard
      // component splits it: analytics tabs get runs only (kind='run'),
      // the Activities tab gets the full set so users can toggle.
      activities: dashboardActivities,
      records,
      athlete: {
        firstname: d.firstname,
        lastname: d.lastname,
        profile: d.profile,
      },
      lastSyncFinishedAt: latestSync?.finishedAt?.toISOString() ?? null,
    }
  },
)

// ── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async ({ context }) => {
    if (!context.session) throw redirect({ to: '/' })
  },
  loader: () => loadDashboardData(),
  component: Dashboard,
})

// ── Tab definitions ────────────────────────────────────────────────

type TabId = 'overview' | 'activities' | 'pace' | 'heart' | 'cadence' | 'records'

const TABS: { id: TabId; icon: typeof LayoutDashboard; label: string }[] = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
  { id: 'activities', icon: List, label: 'Activities' },
  { id: 'pace', icon: Gauge, label: 'Pace' },
  { id: 'heart', icon: Heart, label: 'Heart rate' },
  { id: 'cadence', icon: Footprints, label: 'Cadence' },
  { id: 'records', icon: Trophy, label: 'Personal records' },
]

// ── Dashboard component ────────────────────────────────────────────

function Dashboard() {
  const {
    activities: dashboardActivities,
    records,
    athlete,
    lastSyncFinishedAt: initialFinishedAt,
  } = Route.useLoaderData()

  // Analytics tabs (Overview, Pace, HR, Cadence, Records) only make
  // sense for runs — walking HR/cadence/pace are bimodal vs running and
  // would muddy the charts. ActivitiesTab gets the full set + a toggle.
  const runs = useMemo(
    () => dashboardActivities.filter((a) => activityKind(a) === 'run'),
    [dashboardActivities],
  )

  // Live updates: opens an SSE stream to /api/sync/stream and invalidates
  // this route whenever a background worker publishes an activity-changed
  // event (webhook from Strava, detail-fetch progress, backfill done).
  // See src/features/sync/useLiveUpdates.ts for the wiring details.
  useLiveUpdates()

  const [tab, setTab] = useState<TabId>('overview')
  const [unit, setUnit] = useState<'km' | 'mi'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reko-unit') as 'km' | 'mi') || 'mi'
    }
    return 'mi'
  })

  // Bumped on every Resync click → forces SyncBanner to remount and
  // restart polling, so it picks up the freshly-enqueued sync_log row.
  const [syncTriggerKey, setSyncTriggerKey] = useState(0)

  // Drives the ResyncButton's cooldown ring. Seeded from the loader so
  // it's correct on page load, then updated by SyncBanner's
  // onSyncCompleted callback whenever a sync finishes in this session.
  const [lastSyncFinishedAt, setLastSyncFinishedAt] = useState<Date | null>(
    () => (initialFinishedAt ? new Date(initialFinishedAt) : null),
  )

  const toggleUnit = (u: 'km' | 'mi') => {
    setUnit(u)
    if (typeof window !== 'undefined') localStorage.setItem('reko-unit', u)
  }

  // Mobile nav drawer — fullscreen overlay triggered by the HiViewGridAdd
  // icon in the topbar. Hidden entirely on lg+ since the desktop sidebar
  // covers nav there.
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Lock body scroll while the drawer is open so the underlying page
  // doesn't scroll behind it (iOS especially leaks scroll otherwise).
  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileNavOpen])

  // ESC closes the drawer — keyboard parity with desktop overlays even
  // though primary input on mobile is touch.
  useEffect(() => {
    if (!mobileNavOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mobileNavOpen])

  // Tab pick that also closes the drawer — wired to both the desktop
  // sidebar buttons (no-op for the close, drawer never opens on lg+)
  // and the mobile grid tiles.
  const selectTab = (id: TabId) => {
    setTab(id)
    setMobileNavOpen(false)
  }

  const activeTab = TABS.find((t) => t.id === tab)!

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 w-[240px] bg-[var(--bg-2)] border-r border-[var(--line)] flex flex-col z-40 max-lg:hidden">
        {/* Brand */}
        <div className="px-5 py-5">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 no-underline"
          >
            <span className="brand-mark">
              <span>R</span>
            </span>
            <span className="font-semibold text-xl tracking-tight text-[var(--ink)]">
              Reko
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3.5 mt-1">
          <p className="px-2.5 mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)]">
            Training
          </p>
          <div className="flex flex-col gap-0.5">
            {TABS.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => selectTab(id)}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] transition-colors cursor-pointer ${
                  tab === id
                    ? 'bg-[var(--card)] text-[var(--ink)] font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] border border-[var(--line)]'
                    : 'text-[var(--ink-2)] hover:bg-[rgba(0,0,0,0.04)] hover:text-[var(--ink)] border border-transparent'
                }`}
              >
                <Icon
                  size={14}
                  className={
                    tab === id ? 'text-[var(--accent)]' : 'opacity-80'
                  }
                />
                {label}
              </button>
            ))}
          </div>
        </nav>

        {/* Profile + Resync button (button is a sibling of the link to
            avoid nesting interactive elements, which is invalid HTML). */}
        <div className="relative mx-3.5 mb-3.5">
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-3 py-2.5 border border-[var(--line)] rounded-[10px] bg-[var(--card)] no-underline hover:bg-[var(--card-2)] transition-colors"
          >
            <Avatar name={athlete.firstname} size="md" />
            <div>
              <div className="text-[13px] font-medium text-[var(--ink)]">
                {athlete.firstname} {athlete.lastname}
              </div>
              <div className="font-mono text-[10px] text-[var(--ink-4)]">
                {dashboardActivities.length} activities loaded
              </div>
            </div>
          </Link>
          <ResyncButton
            onTriggered={() => setSyncTriggerKey((k) => k + 1)}
            lastSyncFinishedAt={lastSyncFinishedAt}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-[240px]">
        {/* Sync status banner (auto-hides when nothing to show).
            Keyed by syncTriggerKey so each Resync click remounts it and
            restarts polling against the new sync_log row. */}
        <SyncBanner
          key={syncTriggerKey}
          currentRunCount={runs.length}
          onSyncCompleted={(finishedAt) => setLastSyncFinishedAt(finishedAt)}
        />

        {/* Topbar */}
        <div className="sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--line)] px-4 lg:px-7 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 font-mono text-[12px] text-[var(--ink-3)]">
            {/* Mobile nav trigger — only visible below lg, where the
                desktop sidebar is hidden. Sits at top-left as requested. */}
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden -ml-1 inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
            >
              <HiViewGridAdd size={20} />
            </button>
            <strong className="text-[var(--ink)] font-medium">
              {activeTab.label}
            </strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--card)] border border-[var(--line)] rounded-lg font-mono text-[12px] text-[var(--ink-3)]">
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
              <span className="text-[var(--ink-4)] ml-1.5">⌘K</span>
            </div>
            <div className="inline-flex p-[3px] bg-[var(--card-2)] border border-[var(--line)] rounded-[9px] font-mono text-[11px] font-medium">
              <button
                onClick={() => toggleUnit('km')}
                className={`px-2.5 py-[5px] rounded-[6px] cursor-pointer transition-colors ${
                  unit === 'km'
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'text-[var(--ink-3)] bg-transparent'
                }`}
              >
                km
              </button>
              <button
                onClick={() => toggleUnit('mi')}
                className={`px-2.5 py-[5px] rounded-[6px] cursor-pointer transition-colors ${
                  unit === 'mi'
                    ? 'bg-[var(--ink)] text-[var(--bg)]'
                    : 'text-[var(--ink-3)] bg-transparent'
                }`}
              >
                mi
              </button>
            </div>
          </div>
        </div>

        {/* Tab content */}
        <div className="p-4 lg:p-7 flex flex-col gap-6 min-w-0">
          {tab === 'overview' && <OverviewTab runs={runs} unit={unit} />}
          {tab === 'activities' && (
            <ActivitiesTab activities={dashboardActivities} unit={unit} />
          )}
          {tab === 'pace' && <PaceTab runs={runs} unit={unit} />}
          {tab === 'heart' && <HeartRateTab runs={runs} unit={unit} />}
          {tab === 'cadence' && <CadenceTab runs={runs} unit={unit} />}
          {tab === 'records' && (
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
        <div className="lg:hidden fixed inset-0 z-50 bg-[var(--bg)] flex flex-col">
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--line)]">
            <Link
              to="/"
              onClick={() => setMobileNavOpen(false)}
              className="inline-flex items-center gap-2.5 no-underline"
            >
              <span className="brand-mark">
                <span>R</span>
              </span>
              <span className="font-semibold text-xl tracking-tight text-[var(--ink)]">
                Reko
              </span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close navigation"
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--card)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab grid — 2 columns, bold labels per the user's spec.
              Each tile is a button so keyboard / a11y just works. */}
          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ink-4)] mb-3 px-1">
              Training
            </p>
            <div className="grid grid-cols-2 gap-3">
              {TABS.map(({ id, icon: Icon, label }) => {
                const isActive = tab === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => selectTab(id)}
                    className={`flex flex-col items-start gap-3 p-4 rounded-2xl border text-left transition-colors ${
                      isActive
                        ? 'bg-[var(--card)] border-[var(--accent)] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
                        : 'bg-[var(--card)] border-[var(--line)] hover:bg-[var(--card-2)]'
                    }`}
                  >
                    <Icon
                      size={22}
                      className={
                        isActive ? 'text-[var(--accent)]' : 'text-[var(--ink-3)]'
                      }
                    />
                    <span className="text-[15px] font-bold text-[var(--ink)] leading-tight">
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          </nav>

          {/* User card — same shape as the desktop sidebar footer.
              Profile link + Resync button are siblings (nesting buttons
              inside an anchor would be invalid HTML). Activity count
              shown explicitly per the user's request. */}
          <div className="relative mx-4 mb-4">
            <Link
              to="/profile"
              onClick={() => setMobileNavOpen(false)}
              className="flex items-center gap-2.5 px-3 py-3 border border-[var(--line)] rounded-[12px] bg-[var(--card)] no-underline hover:bg-[var(--card-2)] transition-colors"
            >
              <Avatar name={athlete.firstname} size="md" />
              <div>
                <div className="text-[14px] font-medium text-[var(--ink)]">
                  {athlete.firstname} {athlete.lastname}
                </div>
                <div className="font-mono text-[11px] text-[var(--ink-4)]">
                  {dashboardActivities.length} activities loaded
                </div>
              </div>
            </Link>
            <ResyncButton
              onTriggered={() => setSyncTriggerKey((k) => k + 1)}
              lastSyncFinishedAt={lastSyncFinishedAt}
            />
          </div>
        </div>
      )}
    </div>
  )
}
