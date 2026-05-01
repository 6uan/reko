import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import HeartRateTab from '@/features/dashboard/heart-rate/components/HeartRateTab'

export const Route = createFileRoute('/dashboard/heart-rate')({
  component: DashboardHeartRate,
})

function DashboardHeartRate() {
  const { runs, unit } = useDashboard()
  return <HeartRateTab runs={runs} unit={unit} />
}
