/**
 * Polls sync status every 2s while a backfill is running, shows a thin
 * banner above the dashboard, invalidates the route when fresh data
 * lands so the dashboard re-reads from DB.
 *
 * Hides itself when there's nothing interesting to show (idle, or a
 * success the user already saw).
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { getSyncStatus, type SyncStatus } from './getSyncStatus'

const POLL_MS = 2000
const SUCCESS_TOAST_MS = 4000
/**
 * If a sync_log row's startedAt is within this many ms of our mount
 * time, we treat the resulting success as "ours" (i.e. triggered by the
 * action that caused this banner instance to mount). Anything older is
 * a stale completion the user has already seen — no toast, no
 * cooldown-restart toast.
 */
const FRESH_SYNC_WINDOW_MS = 10_000

export default function SyncBanner({
  currentRunCount,
  onSyncCompleted,
}: {
  /** runs.length the dashboard loader returned — used to detect "DB has new data we haven't loaded yet". */
  currentRunCount: number
  /**
   * Fired when a 'running' sync transitions to 'success' (or when we
   * mount and find a freshly-completed one). The dashboard uses this to
   * restart the ResyncButton's cooldown ring.
   */
  onSyncCompleted?: (finishedAt: Date) => void
}) {
  const router = useRouter()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [successInfo, setSuccessInfo] = useState<{
    delta: number
    total: number
  } | null>(null)

  // Snapshot the count we mounted with — delta = current - baseline
  // tells us whether new runs actually came down or it was a no-op resync.
  const baselineRef = useRef(currentRunCount)

  // Hold the latest onSyncCompleted in a ref so the polling effect can
  // call it without listing it as a dependency — otherwise the inline
  // arrow the parent passes would restart polling on every render.
  const onSyncCompletedRef = useRef(onSyncCompleted)
  useEffect(() => {
    onSyncCompletedRef.current = onSyncCompleted
  })

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let successHideTimer: ReturnType<typeof setTimeout> | null = null
    // Mount time is the anchor for "is this sync something the user
    // just triggered?" — see FRESH_SYNC_WINDOW_MS above.
    const mountTime = Date.now()
    // Dedupe per-finishedAt notifications so we don't fire the toast or
    // re-notify the parent for the same completion across multiple polls.
    let lastReportedFinishedAt: string | null = null

    async function tick() {
      let s: SyncStatus
      try {
        s = await getSyncStatus()
      } catch {
        // Transient network blip — back off and try again
        if (!cancelled) pollTimer = setTimeout(tick, POLL_MS * 2)
        return
      }
      if (cancelled) return

      setStatus(s)

      if (s.status === 'running') {
        pollTimer = setTimeout(tick, POLL_MS)
        return
      }

      // Anything other than 'running' lands here. Check whether the
      // current sync_log row represents a completion we haven't reported
      // yet — covers both the slow case (saw 'running' first) and the
      // fast case (no-op resync that finishes before our first poll).
      const isNewCompletion =
        s.status === 'success' &&
        s.finishedAt !== null &&
        s.finishedAt !== lastReportedFinishedAt

      if (!isNewCompletion) return

      lastReportedFinishedAt = s.finishedAt
      const finishedAt = new Date(s.finishedAt!)

      // Always notify the parent so the ResyncButton's cooldown ring is
      // accurate — even for stale completions it's a no-op state update
      // since the loader already seeded the same value.
      onSyncCompletedRef.current?.(finishedAt)

      // "Fresh" = startedAt is close to our mount time, meaning this
      // sync was kicked off around when we mounted (first-login backfill,
      // or a Resync click that bumped our key). Stale completions from
      // before mount don't get the toast or invalidate.
      const startedAtMs = s.startedAt
        ? new Date(s.startedAt).getTime()
        : null
      const isFreshSync =
        startedAtMs !== null &&
        Math.abs(startedAtMs - mountTime) < FRESH_SYNC_WINDOW_MS

      if (isFreshSync) {
        router.invalidate()
        const delta = s.runCount - baselineRef.current
        setSuccessInfo({ delta, total: s.runCount })
        successHideTimer = setTimeout(() => {
          if (!cancelled) setSuccessInfo(null)
        }, SUCCESS_TOAST_MS)
      }
    }

    tick()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
      if (successHideTimer) clearTimeout(successHideTimer)
    }
  }, [router])

  if (!status) return null

  if (status.status === 'running') {
    return (
      <Banner tone="info">
        <Spinner />
        <span>
          Importing your runs from Strava…{' '}
          <strong className="text-(--ink) font-medium">
            {status.runCount}
          </strong>{' '}
          so far
        </span>
      </Banner>
    )
  }

  if (successInfo && successInfo.total > 0) {
    const { delta, total } = successInfo
    const isNew = delta > 0
    const count = isNew ? delta : total
    const noun = count === 1 ? 'run' : 'runs'
    return (
      <Banner tone="success">
        <Check />
        <span>
          {isNew ? 'Imported ' : 'Up to date · '}
          <strong className="text-(--ink) font-medium">{count}</strong>
          {isNew ? ` new ${noun}` : ` ${noun}`}
        </span>
      </Banner>
    )
  }

  if (status.status === 'error') {
    return (
      <Banner tone="error">
        <span>
          Sync failed: {status.error ?? 'unknown error'}. Try the resync
          button on your profile.
        </span>
      </Banner>
    )
  }

  return null
}

// ── tiny presentational helpers ───────────────────────────────────────

function Banner({
  tone,
  children,
}: {
  tone: 'info' | 'success' | 'error'
  children: React.ReactNode
}) {
  const toneClass =
    tone === 'success'
      ? 'border-[var(--accent)]/40 bg-[var(--accent-soft)]'
      : tone === 'error'
        ? 'border-red-300/60 bg-red-50 text-red-900'
        : 'border-[var(--line)] bg-[var(--card-2)]'

  return (
    <div
      className={`flex items-center gap-2.5 px-7 py-2.5 border-b text-[13px] text-(--ink-2) ${toneClass}`}
    >
      {children}
    </div>
  )
}

function Spinner() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="animate-spin opacity-80"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  )
}

function Check() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="text-(--accent)"
    >
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
