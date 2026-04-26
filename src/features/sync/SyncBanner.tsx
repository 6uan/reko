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

export default function SyncBanner({
  currentRunCount,
}: {
  /** runs.length the dashboard loader returned — used to detect "DB has new data we haven't loaded yet". */
  currentRunCount: number
}) {
  const router = useRouter()
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [successCount, setSuccessCount] = useState<number | null>(null)

  // Snapshot the count we mounted with — successful backfill = runCount
  // grew past this baseline.
  const baselineRef = useRef(currentRunCount)

  useEffect(() => {
    let cancelled = false
    let pollTimer: ReturnType<typeof setTimeout> | null = null
    let successHideTimer: ReturnType<typeof setTimeout> | null = null
    let prevStatus: SyncStatus['status'] | null = null

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

      // Decide whether this is a "fresh completion worth celebrating"
      const transitionedToSuccess =
        s.status === 'success' &&
        (prevStatus === 'running' || s.runCount > baselineRef.current)

      prevStatus = s.status

      if (s.status === 'running') {
        pollTimer = setTimeout(tick, POLL_MS)
      } else if (transitionedToSuccess) {
        // Refresh the dashboard loader so the new runs appear, then show
        // the success toast briefly and hide.
        router.invalidate()
        setSuccessCount(s.runCount)
        successHideTimer = setTimeout(() => {
          if (!cancelled) setSuccessCount(null)
        }, SUCCESS_TOAST_MS)
      }
      // 'idle' / stale 'success' / 'error' — no further polling, render handles it
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
          <strong className="text-[var(--ink)] font-medium">
            {status.runCount}
          </strong>{' '}
          so far
        </span>
      </Banner>
    )
  }

  if (successCount !== null && successCount > 0) {
    return (
      <Banner tone="success">
        <Check />
        <span>
          Imported{' '}
          <strong className="text-[var(--ink)] font-medium">
            {successCount}
          </strong>{' '}
          runs.
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
      className={`flex items-center gap-2.5 px-7 py-2.5 border-b text-[13px] text-[var(--ink-2)] ${toneClass}`}
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
      className="text-[var(--accent)]"
    >
      <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
