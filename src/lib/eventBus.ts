/**
 * In-process pub/sub for "data changed" notifications.
 *
 * Used by the live-updates feature to push refresh signals from
 * background workers (webhook dispatcher, detail-fetch worker, backfill)
 * out to connected dashboard SSE clients in (near-)real time.
 *
 * Why in-memory:
 *   srvx runs as a single long-lived Node process, so a Map<userId, …>
 *   is shared across every request handler in this process. No external
 *   dependency needed for v1. If we ever scale horizontally (multiple
 *   replicas), this needs to become Redis pub/sub or NATS — see the
 *   "Scaling" section in the SSE route's docs.
 *
 * Why scoped per-userId:
 *   A user should never receive another user's refresh signals. Listeners
 *   are keyed by userId so `publish(42, ...)` only wakes up listeners
 *   that subscribed for user 42.
 *
 * Lifecycle:
 *   `subscribe(userId, listener)` returns an unsubscribe function. The
 *   SSE route registers a listener on connect, calls the returned
 *   unsubscribe on disconnect (or when the request aborts). Empty user
 *   buckets are GC'd to keep the Map tidy.
 *
 * NOT durable:
 *   If a user is offline (no SSE connection), the event is dropped on
 *   the floor. Live-updates is a pure refresh hint — the database
 *   already has the truth, so missing a hint just means the user sees
 *   the change on next page load instead of instantly. Don't use this
 *   for anything where missed events are catastrophic.
 */

export type ActivityEvent = {
  type: 'activity-changed'
  /** Why we're nudging the client. Surfaced in logs only — clients refresh
   *  unconditionally on any event today, but keeping `reason` in the
   *  payload lets us add per-source UX later (e.g. only show a toast on
   *  webhook updates) without a new event type. */
  reason: 'webhook' | 'detail-worker' | 'backfill'
}

type Listener = (event: ActivityEvent) => void

const subscribers = new Map<number, Set<Listener>>()

/**
 * Register a listener for a given userId. Returns an unsubscribe
 * function — the caller MUST invoke it when done (e.g. on connection
 * close) or the listener leaks for the process lifetime.
 */
export function subscribe(userId: number, listener: Listener): () => void {
  let set = subscribers.get(userId)
  if (!set) {
    set = new Set()
    subscribers.set(userId, set)
  }
  set.add(listener)

  return () => {
    const s = subscribers.get(userId)
    if (!s) return
    s.delete(listener)
    // GC empty buckets so the Map doesn't grow without bound across
    // the lifetime of the process.
    if (s.size === 0) subscribers.delete(userId)
  }
}

/**
 * Broadcast an event to every listener subscribed for this userId.
 * No-op when nobody's listening (no open dashboards = no work).
 *
 * Listener errors are swallowed so one broken listener can't stop the
 * fan-out to everyone else. Listeners are typically simple stream
 * writes — if they throw, the SSE route's own error path handles it.
 *
 * Logs subscriber count on every publish so prod traces show whether a
 * publish reached any browser. `subs=0` means there was no open SSE
 * connection at that instant — the live update is dropped (NOT durable,
 * by design) and the user will see the change at next page load.
 */
export function publish(userId: number, event: ActivityEvent): void {
  const set = subscribers.get(userId)
  const count = set?.size ?? 0
  console.log(
    `[eventBus] publish userId=${userId} reason=${event.reason} subs=${count}`,
  )
  if (!set || count === 0) return

  for (const listener of set) {
    try {
      listener(event)
    } catch (err) {
      console.error('[eventBus] listener threw:', err)
    }
  }
}

/** Diagnostics — used by tests / admin tooling, not the request path. */
export function getSubscriberCount(userId: number): number {
  return subscribers.get(userId)?.size ?? 0
}
