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
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production

# Bring in deps (we keep dev deps because srvx + drizzle-kit are needed
# at runtime: srvx starts the server, drizzle-kit runs migrations from
# the migrate service in docker-compose).
COPY package.json pnpm-lock.yaml ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Drizzle config + schema. Required at runtime because `start:prod` runs
# `drizzle-kit push --force` against the live DB before starting the
# server — keeps the schema in sync on every deploy without manual steps.
COPY drizzle.config.ts ./
COPY src/db ./src/db

EXPOSE 3000

# `start:prod` = migrate-then-serve. If the migration fails, the server
# never starts and Coolify keeps the previous container running, so a
# bad schema change can't take down prod.
CMD ["pnpm", "start:prod"]
