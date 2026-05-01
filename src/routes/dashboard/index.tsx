import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import OverviewTab from '@/features/dashboard/overview/OverviewTab'

export const Route = createFileRoute('/dashboard/')({
  component: DashboardOverview,
})

function DashboardOverview() {
  const { runs, unit } = useDashboard()
  return <OverviewTab runs={runs} unit={unit} />
}
