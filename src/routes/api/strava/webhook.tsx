/**
 * Strava push subscription webhook endpoint.
 *
 * Strava sends two kinds of requests here:
 *
 * 1. GET — subscription handshake.
 *    Strava POSTs the subscription registration to /push_subscriptions
 *    with a callback_url + verify_token. They then GET that callback_url
 *    immediately with `?hub.mode=subscribe&hub.verify_token=…&hub.challenge=…`.
 *    We must echo `{"hub.challenge": "<challenge>"}` to confirm we own
 *    the URL and we picked the same verify_token. Anything else fails
 *    the registration.
 *
 * 2. POST — event delivery.
 *    Body is the StravaWebhookPayload (object_type, object_id,
 *    aspect_type, owner_id, event_time, …). We must 200 within ~2s or
 *    Strava retries; do NOT do real work in the request — INSERT into
 *    webhook_events (the dedupe unique index makes duplicates a no-op),
 *    fire-and-forget the dispatcher, and return immediately.
 *
 * Security note: there is no signature on the POST body (Strava doesn't
 * sign). The verify_token only protects the GET handshake. Anyone who
 * learns the URL can POST forged events. We mitigate by only acting on
 * `owner_id`s we know in our users table and by treating Strava as the
 * source of truth (the dispatcher re-fetches the activity, so a forged
 * payload can at most trigger an unauthorized re-fetch we'd ignore).
 */

import { createFileRoute } from '@tanstack/react-router'
import { getDb } from '../../../db/client'
import { webhookEvents } from '../../../db/schema'
import {
  handleWebhookEvent,
  type StravaWebhookPayload,
} from '../../../features/sync/handleWebhookEvent'

// ── Handshake (GET) ──────────────────────────────────────────────────────

function handleHandshake(request: Request): Response {
  const url = new URL(request.url)
  const mode = url.searchParams.get('hub.mode')
  const token = url.searchParams.get('hub.verify_token')
  const challenge = url.searchParams.get('hub.challenge')

  const expected = process.env.WEBHOOK_VERIFY_TOKEN
  if (!expected) {
    console.error('[webhook] WEBHOOK_VERIFY_TOKEN unset — rejecting handshake')
    return new Response('Server misconfigured', { status: 500 })
  }

  if (mode !== 'subscribe' || token !== expected || !challenge) {
    console.warn(
      `[webhook] handshake rejected: mode=${mode} tokenMatch=${token === expected} challenge=${!!challenge}`,
    )
    return new Response('Forbidden', { status: 403 })
  }

  // Strava expects the challenge echoed back in JSON with the literal
  // key "hub.challenge". Matching their docs byte-for-byte.
  return Response.json({ 'hub.challenge': challenge })
}

// ── Event delivery (POST) ────────────────────────────────────────────────

async function handleEvent(request: Request): Promise<Response> {
  let payload: StravaWebhookPayload
  try {
    payload = (await request.json()) as StravaWebhookPayload
  } catch (err) {
    console.error('[webhook] invalid JSON body:', err)
    // Return 200 anyway — replying 400 just makes Strava retry, and a
    // malformed body won't ever succeed. Better to drop on the floor.
    return new Response('Bad payload (acked)', { status: 200 })
  }

  // Quick shape check. Strava is consistent here, but defense-in-depth.
  if (
    !payload ||
    typeof payload.object_type !== 'string' ||
    typeof payload.object_id !== 'number' ||
    typeof payload.aspect_type !== 'string' ||
    typeof payload.owner_id !== 'number' ||
    typeof payload.event_time !== 'number'
  ) {
    console.error('[webhook] payload missing required fields:', payload)
    return new Response('Bad payload (acked)', { status: 200 })
  }

  const db = getDb()

  // Insert the durable record. ON CONFLICT DO NOTHING handles Strava's
  // own retries — same (object_type, object_id, aspect_type, event_time)
  // tuple just no-ops, and `inserted` ends up empty so we don't kick off
  // a duplicate dispatch.
  const inserted = await db
    .insert(webhookEvents)
    .values({
      objectType: payload.object_type,
      objectId: payload.object_id,
      aspectType: payload.aspect_type,
      ownerId: payload.owner_id,
      // Strava sends unix seconds; convert to Date for the
      // `timestamp with time zone` column.
      eventTime: new Date(payload.event_time * 1000),
      updates: payload.updates ?? null,
    })
    .onConflictDoNothing({
      target: [
        webhookEvents.objectType,
        webhookEvents.objectId,
        webhookEvents.aspectType,
        webhookEvents.eventTime,
      ],
    })
    .returning({ id: webhookEvents.id })

  if (inserted.length === 0) {
    // Duplicate — already received and either processed or in flight.
    return new Response('OK (duplicate)', { status: 200 })
  }

  // Fire-and-forget. The dispatcher catches its own errors and stamps
  // them onto the webhook_events row, so an unhandled rejection would
  // be a real bug worth knowing about.
  const id = inserted[0].id
  handleWebhookEvent(id, payload).catch((err) => {
    console.error('[webhook] unhandled dispatcher error:', err)
  })

  return new Response('OK', { status: 200 })
}

// ── Route declaration ────────────────────────────────────────────────────
//
// TanStack Start dispatches based on `server.handlers.<METHOD>`. The
// handler ctx provides `{ request, context, params, pathname, next }`;
// we only need `request`. Returning a Response short-circuits the page
// render, which is exactly what we want for a JSON API.

export const Route = createFileRoute('/api/strava/webhook')({
  server: {
    handlers: {
      GET: ({ request }) => handleHandshake(request),
      POST: ({ request }) => handleEvent(request),
    },
  },
})
