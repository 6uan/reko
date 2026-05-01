/**
 * Live-updates client hook — wires the dashboard up to the SSE stream
 * at `/api/sync/stream` and invalidates the route when activity changes
 * happen in the background.
 *
 * Used by:
 *   src/routes/dashboard.tsx — call `useLiveUpdates()` once at the top
 *   of the Dashboard component. It mounts the EventSource on connect,
 *   tears it down on unmount.
 *
 * What it does:
 *   1. Opens an EventSource to `/api/sync/stream` (SSE — same-origin,
 *      session cookie auto-sent).
 *   2. On every 'message' event whose payload is an ActivityEvent, calls
 *      `router.invalidate()` so TanStack Start re-runs the dashboard
 *      loader and the UI re-renders against the freshest DB state.
 *   3. Auto-reconnects on disconnect — that's a built-in EventSource
 *      behaviour, no extra code needed. Default retry is 3s; the server
 *      could send a `retry: <ms>` field to override but we don't bother.
 *
 * Why route.invalidate and not state-merging:
 *   The loader is the single source of truth for runs, records, sync
 *   status, etc. Re-running it is one indexed query against the DB
 *   cache (cheap) and means we never have to keep client state in sync
 *   with server-side derived data (records, leaderboards). Latency for
 *   the user is sub-100ms — no perceptible difference vs in-place merge.
 *
 * What we don't do:
 *   - No reconciliation of which event we missed during a disconnect:
 *     the next event after reconnect re-invalidates anyway, and EventSource
 *     uses `Last-Event-ID` only if we send `id:` lines (we don't —
 *     ActivityEvent is a refresh hint, not an ordered log).
 *   - No retry / backoff handling: the browser already does this.
 *   - No toast / animation on update: the SyncBanner (and ResyncButton's
 *     cooldown ring) already give the user enough feedback. Adding
 *     anything more is a UX call, not a wiring concern.
 *
 * Touchpoints:
 *   - Backed by `src/routes/api/sync/stream.tsx` (the SSE endpoint).
 *   - Source of events is `src/lib/eventBus.ts` (in-memory pub/sub).
 *   - To add a new live-update source, publish to the bus from any
 *     server-side worker (see eventBus.ts comments). No client change
 *     needed — this hook treats every ActivityEvent the same way.
 */

import { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import type { ActivityEvent } from '@/lib/eventBus'

const STREAM_URL = '/api/sync/stream'

/**
 * Coalesce-window for invalidations. Multiple events arriving inside
 * this window get merged into a single `router.invalidate()` call.
 *
 * Why this exists: the detail-fetch worker publishes once per activity,
 * which during a fresh backfill (no rate limit yet) bursts at ~2-5
 * events per second. Without debouncing, each event becomes a loader
 * re-run, and the dashboard hammers itself. 250ms is short enough to
 * still feel "live" (a single webhook arriving on its own gets through
 * with negligible delay) but long enough to swallow worker bursts.
 */
const INVALIDATE_DEBOUNCE_MS = 250

export function useLiveUpdates(): void {
  const router = useRouter()

  useEffect(() => {
    // SSR guard — useEffect doesn't run on the server, but EventSource
    // is browser-only. Cheap belt-and-braces in case we ever change
    // when this fires.
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      return
    }

    const es = new EventSource(STREAM_URL, { withCredentials: true })

    // Debounce timer — see INVALIDATE_DEBOUNCE_MS.
    let pendingInvalidate: ReturnType<typeof setTimeout> | null = null
    const scheduleInvalidate = () => {
      if (pendingInvalidate) clearTimeout(pendingInvalidate)
      pendingInvalidate = setTimeout(() => {
        pendingInvalidate = null
        router.invalidate()
      }, INVALIDATE_DEBOUNCE_MS)
    }

    // 'message' is the default event name in SSE — used by the server's
    // `event: message` lines (see writeEvent in stream.tsx). Worth
    // hitting addEventListener('message') vs `onmessage` so we can also
    // attach to the named 'connected' event below without conflicts.
    const onMessage = (e: MessageEvent) => {
      // Defensive parse — EventSource hands us strings, and a future
      // server-side bug shouldn't crash the dashboard.
      let payload: ActivityEvent | null = null
      try {
        payload = JSON.parse(e.data) as ActivityEvent
      } catch {
        return
      }
      if (payload?.type !== 'activity-changed') return

      // Re-runs the dashboard loader. Debounced so that a burst of
      // events from one publisher (e.g. detail-fetch worker chewing
      // through activities) collapses to a single loader run.
      scheduleInvalidate()
    }

    const onConnected = () => {
      // No-op in prod, but useful breadcrumb during development —
      // confirms the stream is up before any real event arrives.
      if (import.meta.env.DEV) {
        console.log('[live-updates] stream connected')
      }
    }

    const onError = () => {
      // EventSource auto-reconnects on its own; we just log so a sticky
      // failure (server down, auth lost) shows up in DevTools without
      // having to crack open the Network tab.
      if (import.meta.env.DEV) {
        console.warn('[live-updates] stream error — browser will retry')
      }
    }

    es.addEventListener('message', onMessage)
    es.addEventListener('connected', onConnected)
    es.addEventListener('error', onError)

    return () => {
      es.removeEventListener('message', onMessage)
      es.removeEventListener('connected', onConnected)
      es.removeEventListener('error', onError)
      es.close()
      // Drop any debounced invalidate that hadn't fired yet — the
      // component is unmounting, the router instance may already be
      // tearing down, no point in calling invalidate on the way out.
      if (pendingInvalidate) {
        clearTimeout(pendingInvalidate)
        pendingInvalidate = null
      }
    }
  }, [router])
}
