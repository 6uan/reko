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
    /**
     * Local wall-clock time as the athlete saw it; no tz conversion.
     * `mode: 'string'` keeps it as a literal "YYYY-MM-DD HH:MM:SS" — the
     * default Date deserialization would re-interpret it in the server's
     * TZ and shift the wall-clock when dev (local TZ) ≠ prod (UTC).
     */
    startDateLocal: timestamp("start_date_local", {
      withTimezone: false,
      mode: "string",
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

    /**
     * Bumped by the detail-fetch worker after best_efforts + streams are
     * stored for this activity. NULL = "needs detail." Worker filters on
     * IS NULL to find work, so a Strava resync that adds new activities
     * automatically gets them included in the next detail pass.
     */
    detailSyncedAt: timestamp("detail_synced_at", { withTimezone: true }),
  },
  (t) => [
    index("activities_user_start_date_idx").on(t.userId, t.startDate),
    index("activities_user_type_idx").on(t.userId, t.type),
    // Hot path for the worker's "next activity needing detail" query.
    index("activities_user_detail_synced_idx").on(t.userId, t.detailSyncedAt),
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
    /** Wall-clock string (see activities.startDateLocal for rationale). */
    startDateLocal: timestamp("start_date_local", {
      withTimezone: false,
      mode: "string",
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

// ── Derived best efforts (computed from streams when Strava omits them) ─
//
// Strava's `best_efforts` field is empty for some activities even when
// the underlying GPS streams (distance, time) are present — slow paces,
// pause-heavy runs, GPS quality flags, etc. We compute the same numbers
// ourselves with a sliding window over the stored streams so every
// applicable distance has a split.
//
// Stored separately from `best_efforts` so we can show "Strava vs
// derived" comparisons and recompute if the algorithm changes without
// touching Strava-provided data.

export const derivedBestEfforts = pgTable(
  "derived_best_efforts",
  {
    activityId: bigint("activity_id", { mode: "number" })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Canonical effort name — same vocabulary as best_efforts.name. */
    name: text("name").notNull(),
    /** Target distance in meters (1000, 1609.34, 5000, ...). */
    distance: real("distance").notNull(),
    /** Best-effort seconds for this distance over this activity. */
    elapsedTime: integer("elapsed_time").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("derived_best_efforts_activity_name_uidx").on(
      t.activityId,
      t.name,
    ),
    index("derived_best_efforts_user_name_time_idx").on(
      t.userId,
      t.name,
      t.elapsedTime,
    ),
  ],
);

// ── HR zone efforts (best sustained pace per zone, computed from streams) ─
//
// For each (activity, zone), the fastest pace held over a sustained
// window (default 5 min) where every heartrate sample stayed in zone.
// Strava doesn't expose this metric, so we compute it from the streams
// at ingest time.
//
// Stored per-activity-per-zone; the dashboard aggregates to find the
// global best per zone across all of a user's runs.

export const hrZoneEfforts = pgTable(
  "hr_zone_efforts",
  {
    activityId: bigint("activity_id", { mode: "number" })
      .notNull()
      .references(() => activities.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Canonical zone name — e.g. 'Z3 Tempo'. */
    zoneName: text("zone_name").notNull(),
    /** Window duration the pace is sustained over (seconds). */
    windowSeconds: integer("window_seconds").notNull(),
    /** Best sustained pace, seconds per kilometer. */
    paceSecondsPerKm: real("pace_seconds_per_km").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("hr_zone_efforts_activity_zone_window_uidx").on(
      t.activityId,
      t.zoneName,
      t.windowSeconds,
    ),
    index("hr_zone_efforts_user_zone_pace_idx").on(
      t.userId,
      t.zoneName,
      t.paceSecondsPerKm,
    ),
  ],
);

// ── Webhook events (Strava push subscription, idempotency log) ───────────
//
// Strava fires POST /webhook with `{object_type, object_id, aspect_type,
// owner_id, event_time, updates}` whenever an activity is created /
// updated / deleted, or an athlete deauthorizes the app. We acknowledge
// fast (200 immediately) and process asynchronously — every event lands
// here first as a durable queue so a crashed dispatch can be retried.
//
// Idempotency: Strava can (and does) re-fire the same event if we don't
// 200 fast enough, or on retry from their side. The unique index on
// (object_type, object_id, aspect_type, event_time) makes a duplicate
// insert a no-op, so the POST handler can safely race with itself.
//
// `processedAt` IS NULL is the worker's "pending" filter; setting it
// (with `error` NULL) marks success. On failure we set `error` and leave
// `processedAt` NULL so a re-run picks it up.

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: serial("id").primaryKey(),

    /** "activity" | "athlete" — kept text for forward-compat. */
    objectType: text("object_type").notNull(),
    /** Strava activity id (for activity events) or athlete id (for athlete events). */
    objectId: bigint("object_id", { mode: "number" }).notNull(),
    /** "create" | "update" | "delete". */
    aspectType: text("aspect_type").notNull(),
    /** Strava athlete id who owns the object (always present in payload). */
    ownerId: bigint("owner_id", { mode: "number" }).notNull(),
    /** Strava's `event_time` is unix seconds; we store as UTC timestamp. */
    eventTime: timestamp("event_time", { withTimezone: true }).notNull(),

    /**
     * For aspect_type=update only: which fields changed (e.g. {title, type,
     * private, authorized}). Strava doesn't send the new values — we re-fetch
     * the activity to learn what changed. Stored for audit only.
     */
    updates: jsonb("updates").$type<Record<string, unknown>>(),

    /** When our webhook handler INSERTed the row (i.e. event arrived). */
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Set on successful dispatch. NULL = pending or failed. */
    processedAt: timestamp("processed_at", { withTimezone: true }),
    /** Last dispatch error message (NULL on success or before first attempt). */
    error: text("error"),
  },
  (t) => [
    // Idempotency guard: same (object, aspect, event_time) tuple can only
    // land once. Strava-issued retries become a no-op via ON CONFLICT.
    uniqueIndex("webhook_events_dedupe_uidx").on(
      t.objectType,
      t.objectId,
      t.aspectType,
      t.eventTime,
    ),
    // Worker hot path: "give me the oldest unprocessed event."
    index("webhook_events_pending_idx").on(t.processedAt, t.receivedAt),
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
export type DerivedBestEffort = typeof derivedBestEfforts.$inferSelect;
export type NewDerivedBestEffort = typeof derivedBestEfforts.$inferInsert;
export type HrZoneEffort = typeof hrZoneEfforts.$inferSelect;
export type NewHrZoneEffort = typeof hrZoneEfforts.$inferInsert;
export type SyncLogRow = typeof syncLog.$inferSelect;
export type NewSyncLogRow = typeof syncLog.$inferInsert;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
