/**
 * Small icon button in the dashboard sidebar — triggers a fresh sync
 * from Strava. The actual progress UX lives in <SyncBanner />; this
 * button just kicks off the work and remounts the banner so it picks
 * up the new run.
 *
 * Cooldown: every backfill costs at least 1 Strava API call, so after
 * a sync finishes the button is locked out for RESYNC_COOLDOWN_MS. We
 * render an SVG ring around the icon that depletes over the cooldown
 * window — driven by the Web Animations API, so the animation runs
 * without per-frame React re-renders. Server-side guard in
 * enqueueBackfill is the safety net for direct API hits.
 */

import { useEffect, useRef, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { triggerResync } from './triggerResync'
import { RESYNC_COOLDOWN_MS } from './constants'

const RING_SIZE = 16
const RING_RADIUS = 6.5
const RING_STROKE = 2.5
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function getCooldownRemaining(finishedAt: Date | null): number {
  if (!finishedAt) return 0
  return Math.max(
    0,
    RESYNC_COOLDOWN_MS - (Date.now() - finishedAt.getTime()),
  )
}

export default function ResyncButton({
  onTriggered,
  lastSyncFinishedAt,
}: {
  /** Called after a successful trigger so the parent can bump the SyncBanner key. */
  onTriggered: () => void
  /**
   * Timestamp of the most recent finished sync. When within
   * RESYNC_COOLDOWN_MS of now, the button is disabled and the ring
   * depletes. Updated by the parent via SyncBanner's onSyncCompleted.
   */
  lastSyncFinishedAt: Date | null
}) {
  const [busy, setBusy] = useState(false)
  const [inCooldown, setInCooldown] = useState(
    () => getCooldownRemaining(lastSyncFinishedAt) > 0,
  )
  const circleRef = useRef<SVGCircleElement>(null)

  // Sync the cooldown flag with the prop. The setTimeout flips it back
  // off after the remaining ms, which also unmounts the SVG.
  useEffect(() => {
    const remaining = getCooldownRemaining(lastSyncFinishedAt)
    setInCooldown(remaining > 0)
    if (remaining <= 0) return
    const t = setTimeout(() => setInCooldown(false), remaining)
    return () => clearTimeout(t)
  }, [lastSyncFinishedAt])

  // Drive the depleting ring via Web Animations API. Runs only when the
  // SVG is mounted (i.e. inCooldown is true), starts from the partial
  // position so a mid-cooldown page refresh picks up where it left off.
  useEffect(() => {
    if (!inCooldown || !lastSyncFinishedAt || !circleRef.current) return
    const remaining = getCooldownRemaining(lastSyncFinishedAt)
    const elapsed = RESYNC_COOLDOWN_MS - remaining
    const startOffset = CIRCUMFERENCE * (elapsed / RESYNC_COOLDOWN_MS)
    const animation = circleRef.current.animate(
      [
        { strokeDashoffset: startOffset },
        { strokeDashoffset: CIRCUMFERENCE },
      ],
      { duration: remaining, easing: 'linear', fill: 'forwards' },
    )
    return () => animation.cancel()
  }, [inCooldown, lastSyncFinishedAt])

  async function handleClick(e: React.MouseEvent) {
    // Prevent the underlying profile-card link from navigating
    e.preventDefault()
    e.stopPropagation()

    if (busy || inCooldown) return
    setBusy(true)
    try {
      await triggerResync()
      onTriggered()
    } catch (err) {
      console.error('[resync] failed:', err)
    } finally {
      setBusy(false)
    }
  }

  const disabled = busy || inCooldown
  const label = inCooldown
    ? 'Cooling down — Strava rate-limits how often we can resync'
    : 'Resync your activities from Strava'

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      // Explicit w/h forces a square hover area — without them the button
      // defaults to inline-block and its height grows with line-height
      // while width hugs the icon, giving a portrait rectangle.
      className="absolute top-1.5 right-1.5 w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--ink-3)] hover:text-[var(--ink)] hover:bg-[var(--card-2)] transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-[var(--ink-3)]"
    >
      {inCooldown ? (
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          <circle
            ref={circleRef}
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={RING_STROKE}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={0}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
      ) : (
        <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
      )}
    </button>
  )
}
