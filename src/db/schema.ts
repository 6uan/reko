/**
 * Reko database schema (Postgres / Drizzle).
 *
 * Mental model:
 *   - Strava is the source of truth.
 *   - This DB is a cache: dashboard reads from here, sync writes from Strava.
 *   - Activity / best-effort IDs are Strava's own IDs (bigint).
 *   - Internal IDs (users, sync_log, streams) are auto-incrementing serials.
 */

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ── Enums ────────────────────────────────────────────────────────────────

/** Strava stream channels we may pull. One row per (activity, type). */
export const streamTypeEnum = pgEnum("stream_type", [
  "time",
  "distance",
  "latlng",
  "altitude",
  "velocity_smooth",
  "heartrate",
  "cadence",
  "watts",
  "temp",
  "moving",
  "grade_smooth",
]);

export const syncStatusEnum = pgEnum("sync_status", [
  "running",
  "success",
  "error",
  "rate_limited",
]);

// ── Users ────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    stravaAthleteId: bigint("strava_athlete_id", { mode: "number" })
      .notNull()
      .unique(),
    firstname: text("firstname"),
    lastname: text("lastname"),
    profileUrl: text("profile_url"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_strava_athlete_id_uidx").on(t.stravaAthleteId)],
);

// ── Tokens (1:1 with users) ──────────────────────────────────────────────

export const tokens = pgTable("tokens", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  /** Strava's expires_at is unix seconds; we store as UTC timestamp. */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ── Activities ───────────────────────────────────────────────────────────

export const activities = pgTable(
  "activities",
  {
    /** Strava activity id. Fits in JS Number until ~2^53. */
    id: bigint("id", { mode: "number" }).primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    name: text("name").notNull(),
    type: text("type").notNull(),
    sportType: text("sport_type"),

    distance: real("distance").notNull(), // meters
    movingTime: integer("moving_time").notNull(), // seconds
    elapsedTime: integer("elapsed_time").notNull(), // seconds
    totalElevationGain: real("total_elevation_gain").notNull().default(0),

    /** UTC timestamp from Strava (`start_date`). */
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    /** Local wall-clock time as the athlete saw it; no tz conversion. */
    startDateLocal: timestamp("start_date_local", {
      withTimezone: false,
    }).notNull(),

    averageSpeed: real("average_speed"),
    maxSpeed: real("max_speed"),
    averageHeartrate: real("average_heartrate"),
    maxHeartrate: real("max_heartrate"),
    /** Strava reports cadence in RPM for one foot; UI doubles to spm. */
    averageCadence: real("average_cadence"),
    prCount: integer("pr_count").notNull().default(0),
    hasHeartrate: boolean("has_heartrate").notNull().default(false),

    /** Full Strava payload for forward-compat (new fields without migrations). */
    raw: jsonb("raw").$type<unknown>(),

    syncedAt: timestamp("synced_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("activities_user_start_date_idx").on(t.userId, t.startDate),
    index("activities_user_type_idx").on(t.userId, t.type),
  ],
);

// ── Streams (one row per activity per channel) ───────────────────────────

export const streams = pgTable(
  "streams",
  {
    id: serial("id").primaryKey(),
    activityId: bigint("activity_id", { mode: "number" })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    streamType: streamTypeEnum("stream_type").notNull(),
    /** Raw Strava stream `data` array. Kept as jsonb for flexibility. */
    data: jsonb("data").$type<unknown>().notNull(),
    resolution: text("resolution"), // 'low' | 'medium' | 'high'
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("streams_activity_type_uidx").on(t.activityId, t.streamType),
  ],
);

// ── Best efforts (Strava's per-distance splits) ──────────────────────────

export const bestEfforts = pgTable(
  "best_efforts",
  {
    /** Strava best_effort id. */
    id: bigint("id", { mode: "number" }).primaryKey(),
    activityId: bigint("activity_id", { mode: "number" })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    /** Denormalized for fast leaderboard queries. */
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** "1k", "5k", "10k", "Half-Marathon", "Marathon", etc. */
    name: text("name").notNull(),
    distance: real("distance").notNull(), // meters (exact effort distance)
    elapsedTime: integer("elapsed_time").notNull(),
    movingTime: integer("moving_time").notNull(),
    startDateLocal: timestamp("start_date_local", {
      withTimezone: false,
    }).notNull(),
    /** Strava's `pr_rank`: 1 = current PR, 2 = 2nd best, null = not a PR. */
    prRank: integer("pr_rank"),
  },
  (t) => [
    index("best_efforts_user_name_time_idx").on(
      t.userId,
      t.name,
      t.elapsedTime,
    ),
    index("best_efforts_activity_idx").on(t.activityId),
  ],
);

// ── Sync log (audit trail / rate-limit accounting) ───────────────────────

export const syncLog = pgTable(
  "sync_log",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 'backfill' | 'incremental' | 'detail' (kept as text for forward-compat). */
    kind: text("kind").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    callsUsed: integer("calls_used").notNull().default(0),
    status: syncStatusEnum("status").notNull().default("running"),
    error: text("error"),
  },
  (t) => [index("sync_log_user_started_idx").on(t.userId, t.startedAt)],
);

// ── Convenience type exports ─────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
export type Activity = typeof activities.$inferSelect;
export type NewActivity = typeof activities.$inferInsert;
export type Stream = typeof streams.$inferSelect;
export type NewStream = typeof streams.$inferInsert;
export type BestEffort = typeof bestEfforts.$inferSelect;
export type NewBestEffort = typeof bestEfforts.$inferInsert;
export type SyncLogRow = typeof syncLog.$inferSelect;
export type NewSyncLogRow = typeof syncLog.$inferInsert;
