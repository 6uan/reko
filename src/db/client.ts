/**
 * Drizzle client (lazy, cached on globalThis).
 *
 * Why lazy:
 *   - DATABASE_URL is a runtime-only env var on Coolify. Reading it at
 *     module load would crash the build.
 *   - Vite HMR re-evaluates server modules; without globalThis caching
 *     we'd leak pg Pools every save.
 *
 * Use:
 *   import { getDb } from "#/db/client";
 *   const db = getDb();
 *   const rows = await db.select().from(users);
 */

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

type Schema = typeof schema;
type Db = NodePgDatabase<Schema>;

const cache = globalThis as unknown as {
  __rekoPgPool?: pg.Pool;
  __rekoDb?: Db;
};

export function getDb(): Db {
  if (cache.__rekoDb) return cache.__rekoDb;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add it to .env (local) or Coolify env (prod).",
    );
  }

  cache.__rekoPgPool ??= new pg.Pool({
    connectionString: url,
    // Modest pool — srvx is single-process; we don't need many.
    max: 10,
    idleTimeoutMillis: 30_000,
  });

  cache.__rekoDb = drizzle(cache.__rekoPgPool, { schema });
  return cache.__rekoDb;
}

/** For tests / shutdown hooks. */
export async function closeDb(): Promise<void> {
  if (cache.__rekoPgPool) {
    await cache.__rekoPgPool.end();
    cache.__rekoPgPool = undefined;
    cache.__rekoDb = undefined;
  }
}
