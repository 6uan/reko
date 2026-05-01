import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import { sessionConfig, type SessionData } from '@/features/auth/session'
import { clearSessionFn } from '@/features/auth/session'
import { getHealthData } from '@/features/health/getHealthData.server'
import HealthSection from '@/features/health/HealthSection'
import { Avatar } from '@/components/Avatar'

const loadProfileData = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await frameworkGetSession<SessionData>(sessionConfig)
  const d = session.data
  if (!d.userId) throw redirect({ to: '/' })

  const health = await getHealthData(d.userId)
  return { health }
})

export const Route = createFileRoute('/profile')({
  beforeLoad: async ({ context }) => {
    if (!context.session) {
      throw redirect({ to: '/' })
    }
  },
  loader: () => loadProfileData(),
  component: Profile,
})

function Profile() {
  const { session } = Route.useRouteContext()
  const { health } = Route.useLoaderData()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await clearSessionFn()
    navigate({ to: '/' })
  }

  return (
    <section className="pt-12 pb-20">
      <div className="wrap max-w-2xl">
        <h1 className="text-2xl font-semibold text-(--ink) mb-8">
          Profile
        </h1>

        {/* Strava Connection */}
        <div className="p-6 rounded-xl bg-(--card) border border-(--line) shadow-(--shadow-s) mb-6">
          <h2 className="text-sm font-medium text-(--ink-3) uppercase tracking-wider mb-4">
            Strava Connection
          </h2>
          <div className="flex items-center gap-4">
            <Avatar name={session?.firstname} size="lg" />
            <div>
              <p className="font-semibold text-(--ink)">
                {session?.firstname} {session?.lastname}
              </p>
              <p className="text-sm text-(--ink-3)">
                Athlete ID: {session?.athleteId}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>
        </div>

        {/* Preferences */}
        <div className="p-6 rounded-xl bg-(--card) border border-(--line) shadow-(--shadow-s) mb-6">
          <h2 className="text-sm font-medium text-(--ink-3) uppercase tracking-wider mb-4">
            Preferences
          </h2>
          <p className="text-sm text-(--ink-2)">
            Unit and display preferences coming soon.
          </p>
        </div>

        {/* Advanced / Health Diagnostics */}
        <div className="mb-6">
          <HealthSection data={health} />
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
          <h2 className="text-sm font-medium text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
            Danger Zone
          </h2>
          <p className="text-sm text-(--ink-2) mb-4">
            Disconnect your Strava account and delete all local data.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors cursor-pointer"
          >
            Disconnect & Log Out
          </button>
        </div>
      </div>
    </section>
  )
}
