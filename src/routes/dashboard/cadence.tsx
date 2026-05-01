import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import CadenceTab from '@/features/dashboard/cadence/components/CadenceTab'

export const Route = createFileRoute('/dashboard/cadence')({
  component: DashboardCadence,
})

function DashboardCadence() {
  const { runs, unit } = useDashboard()
  return <CadenceTab runs={runs} unit={unit} />
}
