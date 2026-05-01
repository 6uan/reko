import { useCallback, useState } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getSession as frameworkGetSession } from "@tanstack/react-start/server";
import { sessionConfig, type SessionData } from "@/features/auth/session";
import { enqueueBackfill } from "@/features/sync/backfillActivities.server";
import { getActivities } from "@/features/dashboard/activities/getActivities.server";
import { getLastSyncTime } from "@/features/sync/getLastSyncTime.server";
import { getRecordsData } from "@/features/dashboard/records/getRecordsData.server";
import { useLiveUpdates } from "@/features/sync/useLiveUpdates";
import { DashboardProvider } from "@/features/dashboard/DashboardContext";
import SyncBanner from "@/features/sync/SyncBanner";
import Sidebar from "@/features/dashboard/Sidebar";
import Topbar from "@/features/dashboard/Topbar";
import MobileNav from "@/features/dashboard/MobileNav";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useEscapeKey } from "@/lib/useEscapeKey";

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
        />

        <main className="lg:ml-70">
          <SyncBanner
            key={syncTriggerKey}
            currentRunCount={activities.length}
            onSyncCompleted={(finishedAt) => setLastSyncFinishedAt(finishedAt)}
          />
          <Topbar onOpenMobileNav={() => setMobileNavOpen(true)} />
          <div className="p-4 lg:p-6 flex flex-col gap-6 min-w-0">
            <Outlet />
          </div>
        </main>

        {mobileNavOpen && (
          <MobileNav
            athlete={athlete}
            activityCount={activities.length}
            lastSyncFinishedAt={lastSyncFinishedAt}
            onClose={() => setMobileNavOpen(false)}
            onResync={handleResync}
          />
        )}
      </div>
    </DashboardProvider>
  );
}
