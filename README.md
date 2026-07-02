<div align="center">

# Reko

**Every run, measured.**

Open-source, self-hosted running analytics for Strava — personal records
across every distance, leaderboards of your own efforts, and pace trends
you can actually read. Your data stays in your Postgres.

[![CI](https://github.com/6uan/reko/actions/workflows/ci.yml/badge.svg)](https://github.com/6uan/reko/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/demo-reko.run-ef4e1a)](https://reko.run)

<img src="docs/screenshots/overview.jpeg" alt="Reko overview dashboard — training heatmap, HR zones, volume and pace trends" width="100%" />

</div>

## Try it in ten seconds

**[reko.run](https://reko.run) → "Try the demo"** — no account, no OAuth,
nothing to install. The demo is seeded with three synthetic runners so you
can see how the analytics read at every stage of a running life:

- **The New Runner** — ten weeks in, phone in hand. Sparse data, honest
  empty states.
- **The Project** — eighteen months from first jog to half marathon. Watch
  pace fall and heart rate follow.
- **The Machine** — 70 km weeks and two marathon builds. Density stress-test.

Demo sessions are read-only and generated entirely by
[`scripts/seed-demo.ts`](scripts/seed-demo.ts) — zero Strava API calls
involved.

## The dashboard

**Activity detail** — route map, splits, and per-stream charts (pace, heart
rate, cadence, elevation) with hover scrubbing that pins the map to the
chart position.

<p align="center">
  <img src="docs/screenshots/activity-detail.jpeg" alt="Activity detail — Miami Half Marathon with route map, splits and heart-rate chart" width="720" />
</p>

**Trends** — weekly pace, heart-rate zones, and cadence over any time range.
Sustained-pace-per-HR-zone is computed from raw streams — a metric Strava
doesn't surface at all.

<p align="center">
  <img src="docs/screenshots/pace-trends.jpeg" alt="Pace trend over 18 months" width="49%" />
  <img src="docs/screenshots/heart-rate.jpeg" alt="Heart rate zones and efficiency over time" width="49%" />
</p>

**Personal records** — best efforts from 400m to marathon, with progression
over time and every ranked attempt behind each record.

Plus: gear mileage with retirement tracking, a GitHub-style training
heatmap, dark/light themes, and mi/km everywhere.

## How the sync works

Connect once via OAuth and Reko backfills your history: a summary pass
first (your dashboard is useful within seconds), then a background detail
worker pulls best efforts and raw streams per activity, respecting Strava's
rate limits with resumable, stale-lock-safe queue processing. On a public
deploy, Strava webhooks push new activities the moment you save them — an
idempotent, durable event queue means a crashed worker never loses a run.
Derived metrics (per-distance splits, sustained pace per HR zone) are
computed from the stored streams, not fetched.

## Privacy & Strava compliance

- Your Strava data is visible **only to you** — sessions are scoped per
  athlete, and there are no social or cross-user features.
- **Bring your own key**: every self-hosted install registers its own
  Strava API app. Reko never proxies through a shared key.
- Revoking access on Strava purges your tokens and activities via webhook.
- Self-hosted installs run with **no analytics or tracking pixels**.

---

## Run it (self-host)

You need **Docker Desktop** (or OrbStack / Colima) and a **Strava API app**
of your own. Note that since June 2026, Strava requires API developers to
hold an active Strava subscription — see their
[developer program update](https://communityhub.strava.com/insider-journal-9/an-update-to-our-developer-program-13428).

### 1. Register a Strava app

1. Sign in to Strava → https://www.strava.com/settings/api
2. Click **"Create & Manage Your App"**
3. Fill in:
   - **Application Name:** anything (e.g. `My Reko`)
   - **Authorization Callback Domain:** the hostname you'll deploy to,
     **without** the protocol or path. Examples:
     - `localhost` for local-only use
     - `reko.example.com` for a public deploy
4. Save → copy the **Client ID** and **Client Secret**

### 2. Clone and configure

```bash
git clone https://github.com/6uan/reko.git
cd reko

cp .env.example .env
# Edit .env and fill in:
#   STRAVA_CLIENT_ID
#   STRAVA_CLIENT_SECRET
#   SESSION_SECRET   (32+ random chars — see comment in .env.example)
```

### 3. Start the stack

```bash
docker compose up
```

This brings up two services:

- `db` — Postgres 17, persistent volume at `reko_pgdata`
- `app` — Reko on **http://localhost:3000**. Pushes the schema on boot,
  then serves.

First boot takes a couple of minutes (initial image build). Subsequent
starts are seconds.

Open http://localhost:3000, click **Connect with Strava**, authorize,
and your dashboard will populate from your Strava account.

Want the demo personas on your own install? Seed them any time (safe to
re-run; only touches demo users):

```bash
docker compose exec app node --experimental-strip-types scripts/seed-demo.ts
```

### Stop / reset

```bash
docker compose down          # stop, keep data
docker compose down -v       # stop + WIPE database (all activities,
                             # tokens, users — full reset)
```

---

## Local vs production

Same image, two envelopes — hold these four and the rest follows:

- **One image, both places.** `docker compose up` locally builds the exact
  image Coolify runs in prod. Dev (`pnpm dev`) is the only thing that _isn't_
  that image.
- **You provide the secrets locally; Coolify provides them in prod.** Always
  needed: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `SESSION_SECRET`.
  `DATABASE_URL` is injected for you everywhere except host-mode `pnpm dev`.
- **The schema auto-syncs on boot.** The app image runs `drizzle-kit push`
  before serving — no migration step to run by hand, in any environment.
- **Strava callback differs:** `localhost` locally (use a second Strava app),
  your real domain in prod. Webhooks are prod-only — Strava needs public HTTPS.

---

## Develop it (hot reload)

Hacking on Reko itself? Run Postgres in Docker and the app on your host with
Vite HMR — edits reload instantly. This is the daily loop.

```bash
# one-time
cp .env.example .env
#   fill STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, SESSION_SECRET
#   set  DATABASE_URL=postgres://reko:reko_local_dev@localhost:5432/reko
pnpm install
docker compose up -d db     # Postgres only, in the background (127.0.0.1:5432)
pnpm db:push                # create the schema in the fresh DB

# every session
pnpm dev                    # http://localhost:3000, hot reload
```

Re-run `pnpm db:push` after editing `src/db/schema.ts`; `pnpm db:studio`
opens Drizzle Studio to browse the data.

To avoid re-doing Strava OAuth on every restart, set `DEV_AUTH_BYPASS=true`
(and optionally `DEV_USER_ID`) in `.env` to auto-login as an existing user.
Seed the demo personas locally with
`node --experimental-strip-types scripts/seed-demo.ts` and browse them the
same way.

---

## Deploy to production

Reko deploys as a single Docker image — **one build path, the `Dockerfile`.**
The reference deploy is **Coolify** (Dockerfile build pack) on a Hostinger
VPS; the same image runs on any Docker host.

Set on the app in Coolify's **Environment Variables** tab:

- **`DATABASE_URL`** — Coolify wires this from the Postgres resource.
- **`STRAVA_CLIENT_ID`** / **`STRAVA_CLIENT_SECRET`** / **`SESSION_SECRET`**.
- The Strava app's **Authorization Callback Domain** = your public domain.

The image runs `drizzle-kit push` on every boot, so deploys need no manual
migration step. If the push fails the container exits and your previous
deploy keeps running.

---

## Live updates (Strava webhooks, prod only)

By default Reko refreshes from Strava when you hit the **Resync** button
in the sidebar. If you've deployed Reko to a public HTTPS URL, you can
skip the manual sync entirely and have Strava push updates the moment
you save a run.

This is **prod-only** — Strava requires a publicly-reachable HTTPS
callback URL and rejects `localhost`. On a local-only install, just keep
using Resync.

### Setup

1. Add to your prod `.env` (see `.env.example` for details):

   ```bash
   WEBHOOK_VERIFY_TOKEN=<random-string>
   WEBHOOK_CALLBACK_URL=https://your-domain.example.com/api/strava/webhook
   ```

2. Deploy so the new env vars + the `/api/strava/webhook` route are live.

3. Register the subscription with Strava — runs once per environment,
   not per user:

   ```bash
   node --experimental-strip-types scripts/register-webhook.ts subscribe
   ```

   Strava immediately GETs your callback URL to verify the token. If
   that succeeds you'll see `Subscribed. id=<n>`.

### Other commands

```bash
node --experimental-strip-types scripts/register-webhook.ts view        # inspect current sub
node --experimental-strip-types scripts/register-webhook.ts unsubscribe # remove (use before re-subscribing with a new URL)
```

Strava enforces **one subscription per API app**, so re-subscribing to
a different URL means `unsubscribe` first.

### What happens on an event

Strava POSTs `{object_type, object_id, aspect_type, owner_id, …}` to
`/api/strava/webhook`. Reko inserts the event into `webhook_events` (a
durable, deduplicated queue), 200s within milliseconds, and dispatches
the work asynchronously:

- `activity / create` or `update` → re-fetch + upsert the activity;
  the next detail-worker pass picks up its best efforts and streams.
- `activity / delete` → drop the row (cascades to best_efforts + streams).
- `athlete / update` with `authorized=false` → purge the user's tokens
  and activities (they revoked the app).

---

## Stack

- **TanStack Start** — file-based routing, server functions, SSR
- **React 19** + **Tailwind 4**
- **Drizzle ORM** + **Postgres 17** — cache layer over Strava API
- **MapLibre GL** — route maps · **Recharts** — everything else
- **srvx** — production HTTP server
- **pnpm 10** + **Vite 8** (rolldown)
- **Node 22**

## Project structure

```
src/
├── routes/        TanStack file routes (thin handlers)
├── features/      Domain logic, by feature
│   ├── dashboard/   ← tabs: overview, activities, pace,
│   │                  heart-rate, cadence, gear, records
│   ├── sync/        ← backfill, detail worker, webhooks, SSE
│   ├── auth/        ← session + Strava OAuth
│   ├── demo/        ← demo sessions + persona registry
│   ├── health/      ← sync diagnostics (profile page)
│   └── landing/     ← marketing page sections
├── components/    Shared chrome (header, footer, UI primitives)
├── db/            Drizzle schema + lazy client
├── lib/           Strava API client, stream math, helpers
└── hooks/         Shared React hooks
scripts/
├── seed-demo.ts   Demo persona generator (see docs in file)
├── demo/          Routes, physiology model, RNG
└── backfill-*.ts  Derived-metric recomputation
```

## License

MIT — see [`LICENSE`](LICENSE). © 2026 Ipsum Studio LLC.
