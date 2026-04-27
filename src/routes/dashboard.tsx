import { useState } from 'react'
import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import { and, desc, eq, or } from 'drizzle-orm'
import { getDb } from '../db/client'
import { activities, syncLog } from '../db/schema'
import { sessionConfig, type SessionData } from '../features/auth/session'
import { enqueueBackfill } from '../features/sync/backfillActivities'
import ResyncButton from '../features/sync/ResyncButton'
import { Avatar } from '../ui/Avatar'
import SyncBanner from '../features/sync/SyncBanner'
import {
  LayoutDashboard,
  List,
  Gauge,
  Heart,
  Footprints,
  Trophy,
} from 'lucide-react'

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

// ── Data loading ───────────────────────────────────────────────────

const loadDashboardData = createServerFn({ method: 'GET' }).handler(
  async () => {
    const session = await frameworkGetSession<SessionData>(sessionConfig)
    const d = session.data
    if (!d.userId) throw redirect({ to: '/' })

    const db = getDb()

    // Read all runs from the DB cache. Filter to Runs only (Strava splits
    // type/sport_type — match either). Sort newest first.
    const dbRuns = await db
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.userId, d.userId),
          or(eq(activities.type, 'Run'), eq(activities.sportType, 'Run')),
        ),
      )
      .orderBy(desc(activities.startDate))

    const runs: DashboardRun[] = dbRuns.map((a) => ({
      id: a.id,
      name: a.name,
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

    // First-login backfill: if no runs cached, enqueue a sync. The
    // function handles the "already running" idempotency check itself,
    // so this is safe to call on every load when runs.length === 0.
    // Awaited (not fire-and-forget) so the sync_log row is committed
    // before the response — the SyncBanner's first poll then sees it.
    if (runs.length === 0) {
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
      runs,
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
  const { runs, records, athlete, lastSyncFinishedAt: initialFinishedAt } =
    Route.useLoaderData()
  const [tab, setTab] = useState<TabId>('overview')
  const [unit, setUnit] = useState<'km' | 'mi'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('reko-unit') as 'km' | 'mi') || 'km'
    }
    return 'km'
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
                onClick={() => setTab(id)}
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
                {runs.length} runs loaded
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
        <div className="sticky top-0 z-30 bg-[var(--bg)]/80 backdrop-blur-xl border-b border-[var(--line)] px-7 py-3.5 flex items-center justify-between">
          <div className="font-mono text-[12px] text-[var(--ink-3)]">
            <strong className="text-[var(--ink)] font-medium">
              {activeTab.label}
            </strong>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--card)] border border-[var(--line)] rounded-lg font-mono text-[12px] text-[var(--ink-3)]">
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
        <div className="p-7 flex flex-col gap-6 min-w-0">
          {tab === 'overview' && <OverviewTab runs={runs} unit={unit} />}
          {tab === 'activities' && <ActivitiesTab runs={runs} unit={unit} />}
          {tab === 'pace' && <PaceTab runs={runs} unit={unit} />}
          {tab === 'heart' && <HeartRateTab runs={runs} unit={unit} />}
          {tab === 'cadence' && <CadenceTab runs={runs} unit={unit} />}
          {tab === 'records' && (
            <RecordsTab data={records} runs={runs} unit={unit} />
          )}
        </div>
      </main>
    </div>
  )
}
