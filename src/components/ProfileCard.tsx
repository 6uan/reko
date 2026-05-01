import { Link } from '@tanstack/react-router'
import { Avatar } from './Avatar'
import ResyncButton from '@/features/sync/ResyncButton'
import { cn } from '@/lib/cn'

type ProfileCardProps = {
  firstname: string | undefined
  lastname: string | undefined
  activityCount: number
  lastSyncFinishedAt: Date | null
  onResyncTriggered: () => void
  /** Called when the profile link is tapped — used by mobile to close the drawer. */
  onNavigate?: () => void
  className?: string
}

export default function ProfileCard({
  firstname,
  lastname,
  activityCount,
  lastSyncFinishedAt,
  onResyncTriggered,
  onNavigate,
  className,
}: ProfileCardProps) {
  return (
    <div className={cn('relative', className)}>
      <Link
        to="/profile"
        onClick={onNavigate}
        className="flex items-center gap-3 px-3.5 py-3 border border-(--line) rounded-[10px] bg-(--card) no-underline hover:bg-(--card-2) transition-colors"
      >
        <Avatar name={firstname} size="md" />
        <div>
          <div className="text-[14px] font-medium text-(--ink)">
            {firstname} {lastname}
          </div>
          <div className="font-mono text-[11px] text-(--ink-4)">
            {activityCount} activities loaded
          </div>
        </div>
      </Link>
      <ResyncButton
        onTriggered={onResyncTriggered}
        lastSyncFinishedAt={lastSyncFinishedAt}
      />
    </div>
  )
}
