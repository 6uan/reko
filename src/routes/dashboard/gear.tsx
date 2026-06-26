import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { readSessionOnServer } from '@/features/auth/session'
import { getGearData } from '@/features/dashboard/gear/api/getGearData.server'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import GearTab from '@/features/dashboard/gear/components/GearTab'

const fetchGearData = createServerFn({ method: 'GET' }).handler(async () => {
  const s = await readSessionOnServer()
  if (!s?.userId) throw redirect({ to: '/' })
  return getGearData(s.userId)
})

export const Route = createFileRoute('/dashboard/gear')({
  loader: () => fetchGearData(),
  component: GearRoute,
})

function GearRoute() {
  const gear = Route.useLoaderData()
  const { unit } = useDashboard()
  return <GearTab gear={gear} unit={unit} />
}
