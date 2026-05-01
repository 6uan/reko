/**
 * Server-Sent Events (SSE) endpoint for live dashboard updates.
 *
 * Long-lived GET that the dashboard hook (useLiveUpdates) opens via the
 * browser's `EventSource` API. Whenever a background worker publishes an
 * `ActivityEvent` for this user (webhook, detail-fetch, backfill), the
 * stream writes it out and the client invalidates the route — no polling.
 *
 * Why SSE over WebSockets:
 *   We only need server → client. SSE rides on plain HTTP/1.1 chunked
 *   responses, gets auto-reconnect from EventSource for free, and works
 *   through Coolify's Traefik reverse proxy without protocol upgrades.
 *
 * The contract:
 *   - Auth via the session cookie (same cookie as every other route).
 *     Anonymous → 401 immediately.
 *   - On connect: write a `connected` event so the client can confirm
 *     the wire is up. Then subscribe to the in-process eventBus.
 *   - On every published ActivityEvent: write a `message` event with
 *     the JSON-serialised payload.
 *   - Every 25s: write an SSE comment line (`: keepalive`) to keep
 *     intermediaries (Traefik defaults to 60s idle) and Node's own
 *     socket idle timer from killing the connection.
 *   - On disconnect (request.signal aborts): unsubscribe + clear the
 *     keepalive interval. Critical — without this, listeners and timers
 *     leak per dashboard tab opened.
 *
 * Scaling note (read this before scaling horizontally):
 *   The eventBus is process-local (Map in memory). With one srvx instance
 *   this is correct. Two replicas behind a load balancer = a webhook hits
 *   replica A, the user's SSE is on replica B, the event vanishes. The
 *   fix is a Redis (or NATS) pub/sub layer between publishers and the
 *   eventBus — see `src/lib/eventBus.ts` for the contract this would
 *   need to preserve.
 *
 * Touchpoints if you want to add a new live-update source:
 *   1. Import `publish` from `~/lib/eventBus` in your worker / route.
 *   2. Call `publish(userId, { type: 'activity-changed', reason: '<your-reason>' })`
 *      after the DB write commits.
 *   3. Extend the `reason` union in eventBus.ts if it's a new source.
 *   That's it — this route picks it up automatically.
 */

import { createFileRoute } from '@tanstack/react-router'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import {
  type ActivityEvent,
  subscribe,
} from '@/lib/eventBus'
import { sessionConfig, type SessionData } from '@/features/auth/session'

/**
 * Coolify's Traefik default is a 60s idle timeout; Node's `server.timeout`
 * is also non-zero by default. 25s gives us comfortable headroom under
 * the typical 30–60s threshold without spamming the wire.
 */
const KEEPALIVE_INTERVAL_MS = 25_000

async function handleStream(request: Request): Promise<Response> {
  // Auth — read the session cookie. Anonymous users have no business on
  // this stream and we definitely don't want to register an unkeyed
  // listener. Returning 401 lets EventSource fall through to its
  // `onerror` handler instead of treating the connection as healthy.
  const session = await frameworkGetSession<SessionData>(sessionConfig)
  const userId = session.data.userId
  if (!userId) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Helpers — closed over `controller`. Wrapped in try/catch because
      // controller.enqueue throws if the stream has already been closed
      // (which happens the moment the client disconnects). We don't want
      // a stray write to crash the whole route.
      let closed = false
      const safeEnqueue = (chunk: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          // Stream already torn down; flip the flag so subsequent writes
          // (e.g. a final keepalive racing the abort) become no-ops.
          closed = true
        }
      }

      /** Write an SSE event (`event:` + `data:` + blank line). */
      const writeEvent = (event: string, data: unknown) => {
        safeEnqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      }

      /** Write a comment line — invisible to EventSource consumers but
       *  enough bytes on the wire to reset idle timers along the path. */
      const writeKeepalive = () => {
        safeEnqueue(`: keepalive ${Date.now()}\n\n`)
      }

      // Hello packet. Useful for client-side debugging — without it you
      // can't tell "still connecting" from "connected, just nothing
      // happening yet". Reason fields here mirror the ActivityEvent shape
      // so consumers can use one parser.
      writeEvent('connected', { userId, ts: Date.now() })

      // Padding comment — fixes a Coolify / Traefik (and historically
      // Nginx / Cloudflare) class of bug where browsers send
      // `Accept-Encoding: gzip, br` and the proxy decides to compress
      // the response. To compress, it has to buffer; SSE never ends, so
      // the buffer never flushes, and the browser stalls forever
      // (curl works because curl doesn't request compression by default).
      //
      // 2KB of comment bytes is enough to push past the typical compression
      // min-buffer threshold and force an early flush even when a proxy
      // ignores `Content-Encoding: identity` below. Comments (lines starting
      // with `:`) are silently dropped by EventSource, so this is invisible
      // to the client. Sent only once per connection — negligible overhead.
      safeEnqueue(`: ${' '.repeat(2048)}\n\n`)

      // Subscribe AFTER the hello write — guarantees the client sees
      // 'connected' before any data event, which simplifies the hook's
      // ready-state handling.
      const unsubscribe = subscribe(userId, (event: ActivityEvent) => {
        writeEvent('message', event)
      })

      const keepaliveTimer = setInterval(writeKeepalive, KEEPALIVE_INTERVAL_MS)

      // Cleanup. `request.signal` aborts when the client disconnects
      // (closed tab, navigated away, network drop). Without this we leak
      // both a listener AND an interval per ever-opened dashboard.
      const onAbort = () => {
        closed = true
        clearInterval(keepaliveTimer)
        unsubscribe()
        try {
          controller.close()
        } catch {
          // Already closed by the runtime — nothing to do.
        }
      }

      if (request.signal.aborted) {
        onAbort()
      } else {
        request.signal.addEventListener('abort', onAbort, { once: true })
      }
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      // Long-lived connection — disable proxy / browser caching.
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disables response buffering on Nginx-style proxies. Traefik
      // doesn't buffer by default but this is a cheap insurance policy
      // for anyone fronting Reko with a different proxy.
      'X-Accel-Buffering': 'no',
      // Explicit "no encoding" — tells well-behaved proxies (Traefik,
      // Cloudflare) NOT to apply gzip/br compression even when the
      // browser asks for it via Accept-Encoding. Compression breaks SSE
      // because the proxy must buffer the whole response to compress it.
      // Paired with the 2KB padding comment in the stream's start() to
      // defeat proxies that ignore this header.
      'Content-Encoding': 'identity',
    },
  })
}

export const Route = createFileRoute('/api/sync/stream')({
  server: {
    handlers: {
      GET: ({ request }) => handleStream(request),
    },
  },
})
