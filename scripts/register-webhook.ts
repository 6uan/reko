/**
 * Strava push subscription CLI — Chunk 1.3.e.
 *
 * One-time setup: tells Strava to start POSTing activity / athlete events
 * to our /api/strava/webhook endpoint. There is exactly ONE subscription
 * per Strava API application (not per user), so this is run once per
 * environment (prod / staging) — not per athlete.
 *
 * Strava's push subscription API:
 *   POST   /push_subscriptions  → create
 *   GET    /push_subscriptions  → view current (returns []| [{id, callback_url, ...}])
 *   DELETE /push_subscriptions/:id  → remove
 *
 * Auth uses client_id + client_secret as form fields (NOT a bearer token).
 *
 * Usage:
 *   pnpm exec tsx scripts/register-webhook.ts view
 *   pnpm exec tsx scripts/register-webhook.ts subscribe
 *   pnpm exec tsx scripts/register-webhook.ts unsubscribe
 *
 * Env (loaded via dotenv/config — same pattern as scripts/test-detail-fetch.ts):
 *   STRAVA_CLIENT_ID
 *   STRAVA_CLIENT_SECRET
 *   WEBHOOK_VERIFY_TOKEN     — any random string. Strava echoes this back
 *                              on the GET handshake; our route asserts equality.
 *   WEBHOOK_CALLBACK_URL     — public HTTPS URL. e.g.
 *                              https://reko.run/api/strava/webhook
 *                              MUST be reachable from the public internet —
 *                              Strava won't accept localhost (use prod, or a
 *                              tunnel like cloudflared / ngrok for dev).
 *
 * NOTE: Strava only allows ONE active subscription per app. `subscribe`
 * fails with "an existing subscription is already present" if you have
 * one — run `unsubscribe` first, or just use `view` to check.
 */

import 'dotenv/config'

const STRAVA_API = 'https://www.strava.com/api/v3'

type Subscription = {
  id: number
  application_id: number
  callback_url: string
  created_at: string
  updated_at: string
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
  return v
}

async function viewSubscriptions(): Promise<void> {
  const clientId = requireEnv('STRAVA_CLIENT_ID')
  const clientSecret = requireEnv('STRAVA_CLIENT_SECRET')

  const url = new URL(`${STRAVA_API}/push_subscriptions`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)

  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    console.error(`Strava view failed (${res.status}): ${text}`)
    process.exit(1)
  }

  const subs = (await res.json()) as Subscription[]
  if (subs.length === 0) {
    console.log('No active subscriptions.')
    return
  }
  console.log(`Found ${subs.length} subscription(s):`)
  console.table(
    subs.map((s) => ({
      id: s.id,
      callback_url: s.callback_url,
      created_at: s.created_at,
    })),
  )
}

async function subscribe(): Promise<void> {
  const clientId = requireEnv('STRAVA_CLIENT_ID')
  const clientSecret = requireEnv('STRAVA_CLIENT_SECRET')
  const callbackUrl = requireEnv('WEBHOOK_CALLBACK_URL')
  const verifyToken = requireEnv('WEBHOOK_VERIFY_TOKEN')

  if (!callbackUrl.startsWith('https://')) {
    console.error(
      `WEBHOOK_CALLBACK_URL must be HTTPS (got: ${callbackUrl}). Strava rejects http:// URLs.`,
    )
    process.exit(1)
  }

  console.log(`Subscribing ${callbackUrl} …`)
  console.log(
    'Strava will GET this URL immediately to verify; ensure the dev server / prod app is reachable.',
  )

  // Strava expects application/x-www-form-urlencoded for this endpoint.
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    callback_url: callbackUrl,
    verify_token: verifyToken,
  })

  const res = await fetch(`${STRAVA_API}/push_subscriptions`, {
    method: 'POST',
    body,
  })

  const text = await res.text()
  if (!res.ok) {
    console.error(`Strava subscribe failed (${res.status}): ${text}`)
    if (text.includes('already present')) {
      console.error(
        '\nThere is already an active subscription. Run `view` to inspect, then `unsubscribe <id>` to remove it before re-subscribing.',
      )
    }
    process.exit(1)
  }

  const sub = JSON.parse(text) as { id: number }
  console.log(`Subscribed. id=${sub.id}`)
  console.log('Strava will now POST events to your callback URL.')
}

async function unsubscribe(idArg?: string): Promise<void> {
  const clientId = requireEnv('STRAVA_CLIENT_ID')
  const clientSecret = requireEnv('STRAVA_CLIENT_SECRET')

  // Resolve subscription id: arg wins; otherwise derive from `view` (only
  // works when there's exactly one subscription, which is Strava's hard
  // limit anyway).
  let id: number
  if (idArg) {
    id = Number(idArg)
    if (!Number.isFinite(id)) {
      console.error(`Invalid subscription id: ${idArg}`)
      process.exit(1)
    }
  } else {
    const url = new URL(`${STRAVA_API}/push_subscriptions`)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('client_secret', clientSecret)
    const res = await fetch(url)
    const subs = (await res.json()) as Subscription[]
    if (subs.length === 0) {
      console.log('No active subscription to remove.')
      return
    }
    id = subs[0].id
  }

  const url = new URL(`${STRAVA_API}/push_subscriptions/${id}`)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('client_secret', clientSecret)
  const res = await fetch(url, { method: 'DELETE' })

  if (!res.ok) {
    const text = await res.text()
    console.error(`Strava unsubscribe failed (${res.status}): ${text}`)
    process.exit(1)
  }
  console.log(`Unsubscribed id=${id}.`)
}

async function main(): Promise<void> {
  const cmd = process.argv[2]
  switch (cmd) {
    case 'view':
      await viewSubscriptions()
      break
    case 'subscribe':
      await subscribe()
      break
    case 'unsubscribe':
      await unsubscribe(process.argv[3])
      break
    default:
      console.log(
        'Usage: pnpm exec tsx scripts/register-webhook.ts <view|subscribe|unsubscribe [id]>',
      )
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
