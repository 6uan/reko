import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { readSessionOnServer } from '@/features/auth/session'
import { getActivityDetail } from '@/features/dashboard/activity/api/getActivityDetail.server'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import ActivityDetailPage from '@/features/dashboard/activity/components/ActivityDetailPage'
import Card from '@/features/dashboard/ui/Card'
import EmptyState from '@/features/dashboard/ui/EmptyState'

// ── Server fn ──────────────────────────────────────────────────────

const fetchActivityDetail = createServerFn({ method: 'GET' })
  .inputValidator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    const s = await readSessionOnServer()
    if (!s?.userId) throw redirect({ to: '/' })
    return getActivityDetail(s.userId, data.id)
  })

// ── Route ──────────────────────────────────────────────────────────

export const Route = createFileRoute('/dashboard/activity/$id')({
  loader: async ({ params }) => {
    const id = Number(params.id)
    // Activity ids are Strava bigints that fit in a JS number; reject
    // non-numeric / unsafe ids without hitting the DB.
    if (!Number.isSafeInteger(id) || id <= 0) return { detail: null }
    return { detail: await fetchActivityDetail({ data: { id } }) }
  },
  component: ActivityDetailRoute,
})

function ActivityDetailRoute() {
  const { detail } = Route.useLoaderData()
  const { unit } = useDashboard()

  if (!detail) {
    return (
      <Card className="p-10">
        <div className="flex flex-col items-center gap-3">
          <EmptyState>Activity not found.</EmptyState>
          <Link
            to="/dashboard/activities"
            className="text-sm text-(--accent) no-underline hover:underline"
          >
            ← Back to activities
          </Link>
        </div>
      </Card>
    )
  }

  return <ActivityDetailPage detail={detail} unit={unit} />
}
