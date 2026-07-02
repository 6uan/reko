import { useCallback, useState } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readSessionOnServer } from '@/features/auth/session.server';
import { enqueueBackfill } from "@/features/sync/api/backfillActivities.server";
import { getActivities } from "@/features/dashboard/activities/api/getActivities.server";
import { getLastSyncTime } from "@/features/sync/api/getLastSyncTime.server";
import { getRecordsData } from "@/features/dashboard/records/api/getRecordsData.server";
import { useLiveUpdates } from "@/features/sync/useLiveUpdates";
import {
  DashboardProvider,
  useDashboard,
} from "@/features/dashboard/DashboardContext";
import SyncBanner from "@/features/sync/SyncBanner";
import DemoBanner from "@/features/demo/DemoBanner";
import Sidebar from "@/features/dashboard/Sidebar";
import Topbar from "@/features/dashboard/Topbar";
import MobileNav from "@/features/dashboard/MobileNav";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Data loading ───────────────────────────────────────────────────

const loadDashboardData = createServerFn({ method: "GET" }).handler(
  async () => {
    const d = await readSessionOnServer();
    if (!d?.userId) throw redirect({ to: "/" });

    const [activities, records, lastSyncFinishedAt] = await Promise.all([
      getActivities(d.userId),
      getRecordsData(d.userId),
      getLastSyncTime(d.userId),
    ]);

    // Auto-backfill first-time users — but never demo sessions: their
    // history is seeded, and their "tokens" must never reach Strava.
    if (activities.length === 0 && !d.demo) {
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
  // Data is shared across all tabs via DashboardContext. Don't re-fetch
  // on tab switches — live updates (SSE) handle refreshes when data
  // actually changes.
  staleTime: Infinity,
  component: DashboardLayout,
});

// ── Layout component ──────────────────────────────────────────────

function DashboardLayout() {
  const {
    activities,
    records,
    athlete,
    lastSyncFinishedAt: initialFinishedAt,
  } = Route.useLoaderData();
  const { session } = Route.useRouteContext();
  const demo = session?.demo === true;

  useLiveUpdates();

  const [syncTriggerKey, setSyncTriggerKey] = useState(0);
  const [lastSyncFinishedAt, setLastSyncFinishedAt] = useState<Date | null>(
    () => (initialFinishedAt ? new Date(initialFinishedAt) : null),
  );

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useBodyScrollLock(mobileNavOpen);
  useEscapeKey(
    mobileNavOpen,
    useCallback(() => setMobileNavOpen(false), []),
  );

  const handleResync = useCallback(() => setSyncTriggerKey((k) => k + 1), []);

  return (
    <DashboardProvider activities={activities} records={records}>
      <div className="min-h-screen bg-(--bg)">
        <Sidebar
          athlete={athlete}
          activityCount={activities.length}
          lastSyncFinishedAt={lastSyncFinishedAt}
          onResync={handleResync}
          demo={demo}
        />

        <main className="lg:ml-70">
          {demo ? (
            <DemoBanner athleteId={session!.athleteId} />
          ) : (
            <SyncBanner
              key={syncTriggerKey}
              currentRunCount={activities.length}
              onSyncCompleted={(finishedAt) => setLastSyncFinishedAt(finishedAt)}
            />
          )}
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <div className="p-4 lg:p-6 flex flex-col gap-6 min-w-0">
            <DashboardOutlet />
          </div>
        </main>

        {mobileNavOpen && (
          <MobileNav
            athlete={athlete}
            activityCount={activities.length}
            lastSyncFinishedAt={lastSyncFinishedAt}
            onClose={() => setMobileNavOpen(false)}
            onResync={handleResync}
            demo={demo}
          />
        )}
      </div>
    </DashboardProvider>
  );
}

function DashboardOutlet() {
  const { unit } = useDashboard();
  return <Outlet key={unit} />;
}
