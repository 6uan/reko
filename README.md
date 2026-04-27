# Reko

Open-source running analytics for Strava. Personal records across every
distance, leaderboards of your own efforts, pace trends you can read.
Self-hosted — your data stays yours.

[reko.run](https://reko.run) · MIT · Postgres + TanStack Start + React 19

---

## Self-host (5 minutes)

You need:
- **Docker Desktop** (or OrbStack / Colima) — that's it. No Node, no
  Postgres, no toolchain to install.
- A **Strava API app** of your own (BYOK — Reko never proxies through
  a shared key).

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

This brings up three services:
- `postgres` — Postgres 17, persistent volume at `reko_pgdata`
- `migrate` — runs Drizzle migrations once and exits
- `app` — Reko on **http://localhost:3000**

First boot takes a couple of minutes (initial image build). Subsequent
starts are seconds.

Open http://localhost:3000, click **Connect with Strava**, authorize,
and your dashboard will populate from your Strava account.

### Stop / reset

```bash
docker compose down          # stop, keep data
docker compose down -v       # stop + WIPE database (all activities,
                             # tokens, users — full reset)
```

---

## Local development (with hot-reload)

If you're hacking on Reko itself you'll want `pnpm dev` for HMR, while
still using a Dockerised Postgres. Two terminals:

```bash
# Terminal 1: just Postgres (binds to 127.0.0.1:5432)
docker compose up postgres

# Terminal 2: app on the host with hot-reload
pnpm install
DATABASE_URL=postgres://reko:reko_local_dev@localhost:5432/reko pnpm dev
```

Then visit http://localhost:3000.

For one-off DB introspection:

```bash
pnpm db:studio          # opens Drizzle Studio at https://local.drizzle.studio
pnpm db:push            # apply schema changes to local Postgres
pnpm db:generate        # generate a SQL migration (for production)
```

---

## Deploy to a public URL

Reko ships with both a `Dockerfile` (any container host) and a
`nixpacks.toml` (Coolify, Railway, Render). Pick whichever your host
prefers.

You'll need:
- **Postgres 17** reachable from the app container
- **`DATABASE_URL`** env var pointing at it
- **`STRAVA_CLIENT_ID`** / **`STRAVA_CLIENT_SECRET`** / **`SESSION_SECRET`**
  set on the app
- The Strava API app's **Authorization Callback Domain** matching your
  public hostname

Reko's reference deploy uses Coolify on a Hostinger VPS; the same image
runs anywhere Docker does.

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
   pnpm exec tsx scripts/register-webhook.ts subscribe
   ```

   Strava immediately GETs your callback URL to verify the token. If
   that succeeds you'll see `Subscribed. id=<n>`.

### Other commands

```bash
pnpm exec tsx scripts/register-webhook.ts view        # inspect current sub
pnpm exec tsx scripts/register-webhook.ts unsubscribe # remove (use before re-subscribing with a new URL)
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
- **srvx** — production HTTP server
- **pnpm 10** + **Vite 8** (rolldown)
- **Node 22**

## Project structure

```
src/
├── routes/        TanStack file routes (thin handlers)
├── features/      Domain logic, by feature
│   ├── activities/, overview/, pace/, heart-rate/,
│   │   cadence/, records/      ← dashboard tabs
│   ├── auth/                   ← session + OAuth
│   └── landing/                ← marketing page sections
├── db/            Drizzle schema + lazy client
├── lib/           External integrations (strava.ts) + helpers
└── ui/            Shared chrome (Header, Footer, ThemeToggle)
```

## License

MIT — see `LICENSE`.
