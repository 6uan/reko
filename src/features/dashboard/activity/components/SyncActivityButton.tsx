/**
 * "Sync this activity" button — pulls Strava detail (best_efforts + streams)
 * for one activity, then invalidates the route so the page re-renders with the
 * freshly stored data. Used prominently in the no-streams empty state and as a
 * quiet refresh in the detail header.
 */

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { resyncActivity } from '@/features/sync/resyncActivity'

type Props = {
  activityId: number
  variant?: 'primary' | 'ghost'
  label?: string
}

export default function SyncActivityButton({
  activityId,
  variant = 'primary',
  label = 'Sync this activity',
}: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setSyncing(true)
    setError(null)
    try {
      const res = await resyncActivity({ data: activityId })
      if (res.ok) {
        await router.invalidate()
      } else {
        setError(res.message)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  const base =
    'inline-flex items-center gap-1.5 rounded-(--radius-s) transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
  const styles =
    variant === 'primary'
      ? 'px-4 py-2 text-sm bg-(--accent-soft) text-(--ink) hover:opacity-90'
      : 'px-3 py-1.5 text-sm border border-(--line) bg-(--card) text-(--ink-3) hover:text-(--ink)'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={syncing}
        className={`${base} ${styles}`}
      >
        {syncing ? 'Syncing…' : label}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}
