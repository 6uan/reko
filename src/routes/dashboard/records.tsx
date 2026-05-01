import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import RecordsTab from '@/features/dashboard/records/RecordsTab'

export const Route = createFileRoute('/dashboard/records')({
  component: DashboardRecords,
})

function DashboardRecords() {
  const { runs, records, unit } = useDashboard()
  return <RecordsTab data={records} runs={runs} unit={unit} />
}
