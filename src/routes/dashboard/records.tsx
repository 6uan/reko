import { createFileRoute } from '@tanstack/react-router'
import { useDashboard } from '@/features/dashboard/DashboardContext'
import RecordsTab from '@/features/dashboard/records/components/RecordsTab'

export const Route = createFileRoute('/dashboard/records')({
  component: DashboardRecords,
})

function DashboardRecords() {
  // Records are all-time by nature — use the unscoped runs so the global
  // time-range toggle doesn't truncate PR history.
  const { allRuns, records, unit } = useDashboard()
  return <RecordsTab data={records} runs={allRuns} unit={unit} />
}
