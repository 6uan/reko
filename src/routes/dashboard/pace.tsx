import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import PaceTab from '@/features/dashboard/pace/PaceTab'

export const Route = createFileRoute('/dashboard/pace')({
  component: DashboardPace,
})

function DashboardPace() {
  const { runs, unit } = useDashboard()
  return <PaceTab runs={runs} unit={unit} />
}
