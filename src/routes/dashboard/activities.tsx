import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import ActivitiesTab from '@/features/dashboard/activities/ActivitiesTab'

export const Route = createFileRoute('/dashboard/activities')({
  component: DashboardActivities,
})

function DashboardActivities() {
  const { activities, unit } = useDashboard()
  return <ActivitiesTab activities={activities} unit={unit} />
}
