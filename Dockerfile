# syntax=docker/dockerfile:1.7
#
# Reko production image — multi-stage build.
#
#   deps    →  install pnpm deps (cached separately from source changes)
#   build   →  vite build → dist/server + dist/client
#   runtime →  the slim image we actually ship
#
# Base: node:22-slim (Debian). NOT alpine — package.json declares
# libc: ["glibc"], and the rolldown native binding ships glibc-only.
#
# Runtime stage deliberately omits pnpm/corepack — both are build-time
# tools. Keeping them at runtime meant corepack lazily downloaded pnpm
# from npmjs on every container start (visible as "Corepack is about to
# download pnpm-X.Y.Z.tgz" in deploy logs). That's a hidden network
# dependency: an npmjs outage would turn into a container-start failure.
# Calling drizzle-kit / srvx directly via PATH avoids it entirely.

# ── Stage 1: deps ────────────────────────────────────────────────────────
FROM node:22-slim AS deps
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./

# Cache the pnpm content-addressable store across builds.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ── Stage 2: build ───────────────────────────────────────────────────────
FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm build

# ── Stage 3: runtime ─────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Lets the CMD call binaries from node_modules by name without pnpm/npx.
ENV PATH="/app/node_modules/.bin:$PATH"

# Bring in deps (dev deps included: drizzle-kit runs the pre-flight
# migration, srvx serves the app — both live in node_modules/.bin).
COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Drizzle config + schema. Required at runtime because the CMD below
# runs `drizzle-kit push --force` against the live DB before starting
# the server — keeps the schema in sync on every deploy without manual
# steps. Migration failure aborts before srvx starts, so Coolify keeps
# the previous container running on a bad schema change.
COPY drizzle.config.ts ./
COPY src/db ./src/db

EXPOSE 3000

# Migrate-then-serve, inlined from the `start:prod` package.json script
# so the runtime image doesn't need pnpm. Shell form so `${PORT:-3000}`
# expands; `exec` on srvx so it replaces the shell as PID 1 — that way
# SIGTERM from Coolify routes to the Node process directly instead of
# getting swallowed by an intermediate /bin/sh.
CMD ["/bin/sh", "-c", "drizzle-kit push --force && exec srvx --prod -s ../client --port ${PORT:-3000} dist/server/server.js"]
