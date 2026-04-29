/**
 * Webhook event dispatcher (SERVER ONLY).
 *
 * Strava push subscription POSTs land at /api/strava/webhook, which
 * inserts a row into `webhook_events` and then calls this dispatcher
 * fire-and-forget. This keeps the HTTP handler under Strava's 2-second
 * acknowledgment window — anything heavier than "INSERT ... RETURNING id"
 * runs out here, off the request's hot path.
 *
 * Event shape (Strava's payload):
 *   {
 *     object_type: "activity" | "athlete",
 *     object_id: number,            // activity id, or athlete id for athlete events
 *     aspect_type: "create" | "update" | "delete",
 *     owner_id: number,             // strava athlete id who owns the object
 *     event_time: number,           // unix seconds
 *     subscription_id: number,
 *     updates?: Record<string, string>  // present on aspect_type=update
 *   }
 *
 * Routing matrix (what we do per (object_type, aspect_type)):
 *   activity / create  → fetch detail + map + insert; queue detail-fetch
 *                        for streams + best_efforts.
 *   activity / update  → re-fetch detail + map + upsert. Strava sends
 *                        `updates: { authorized: "false" }` here when the
 *                        athlete revokes access — we treat that as deauth
 *                        (purge tokens + activities), same as athlete/update.
 *   activity / delete  → DELETE FROM activities (cascades to best_efforts +
 *                        streams via FK ON DELETE CASCADE).
 *   athlete  / update  → if updates.authorized === "false", purge user.
 *                        Other athlete updates are no-ops; Strava only
 *                        ever sends authorized=false in practice.
 *
 * Errors:
 *   The dispatcher is best-effort — it logs failures and stamps the
 *   webhook_events row with an error message, but never re-throws (the
 *   route caller is fire-and-forget, throwing would crash the worker).
 *   On failure, processedAt stays NULL so a future replay can pick it up.
 */

import { eq } from 'drizzle-orm'
import { getDb } from '../../db/client'
import {
  activities,
  tokens,
  users,
  webhookEvents,
} from '../../db/schema'
import { publish } from '../../lib/eventBus'
import { fetchActivityDetail } from '../../lib/strava'
import { mapStravaActivity } from './mapStravaActivity.server'
import { withFreshToken } from './withFreshToken.server'

export type StravaWebhookPayload = {
  object_type: 'activity' | 'athlete' | string
  object_id: number
  aspect_type: 'create' | 'update' | 'delete' | string
  owner_id: number
  event_time: number
  subscription_id?: number
  updates?: Record<string, string>
}

/**
 * Process a webhook_events row. Idempotent — safe to call repeatedly
 * for the same row (the underlying writes are upserts / deletes).
 *
 * `webhookEventId` is the primary key of the row inserted by the route;
 * we use it to stamp `processedAt` / `error` on completion.
 */
export async function handleWebhookEvent(
  webhookEventId: number,
  payload: StravaWebhookPayload,
): Promise<void> {
  const db = getDb()

  try {
    // Resolve owner_id (Strava athlete id) → our internal user id. If we
    // don't know this athlete, we silently mark the event processed —
    // they probably never connected to Reko, or their account was
    // already purged. Strava won't stop sending events for them until
    // we delete the subscription.
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stravaAthleteId, payload.owner_id))
      .limit(1)

    if (!user) {
      console.log(
        `[webhook] event ${webhookEventId}: owner_id=${payload.owner_id} not in users table — skipping`,
      )
      await markProcessed(webhookEventId)
      return
    }

    if (payload.object_type === 'activity') {
      await handleActivityEvent(user.id, payload)
      // Live-updates fan-out: nudge any open dashboard tabs for this user
      // to re-run their loader. The eventBus is in-memory and per-process
      // (see src/lib/eventBus.ts) — no listeners = no work, no harm.
      // Covers create, update, and delete; the deauth path also lands
      // here, which is fine (invalidating the loader on deauth surfaces
      // the empty state immediately rather than at next page load).
      publish(user.id, { type: 'activity-changed', reason: 'webhook' })
    } else if (payload.object_type === 'athlete') {
      await handleAthleteEvent(user.id, payload)
    } else {
      console.log(
        `[webhook] event ${webhookEventId}: unknown object_type=${payload.object_type} — skipping`,
      )
    }

    await markProcessed(webhookEventId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[webhook] event ${webhookEventId} failed:`, err)
    await db
      .update(webhookEvents)
      .set({ error: message })
      .where(eq(webhookEvents.id, webhookEventId))
    // Intentionally do NOT re-throw — caller is fire-and-forget.
  }
}

// ── Per-object-type handlers ─────────────────────────────────────────────

async function handleActivityEvent(
  userId: number,
  payload: StravaWebhookPayload,
): Promise<void> {
  const db = getDb()
  const activityId = payload.object_id

  // Strava overloads activity/update with `updates.authorized = "false"`
  // for app-revocation. Mirror athlete/update path — the activity itself
  // is irrelevant in that case.
  if (
    payload.aspect_type === 'update' &&
    payload.updates?.authorized === 'false'
  ) {
    await purgeUser(userId)
    return
  }

  if (payload.aspect_type === 'delete') {
    // FK cascades take care of best_efforts + streams + sync_log refs.
    await db.delete(activities).where(eq(activities.id, activityId))
    console.log(`[webhook] deleted activity ${activityId} for user ${userId}`)
    return
  }

  if (payload.aspect_type === 'create' || payload.aspect_type === 'update') {
    // Fetch + upsert. We don't use the dedicated detail-fetch worker here
    // because that's queue-based (one activity at a time, rate-limited);
    // a single webhook event is cheap enough to handle inline.
    const accessToken = await withFreshToken(userId)
    const detail = await fetchActivityDetail(accessToken, activityId)
    const row = mapStravaActivity(userId, detail)

    await db
      .insert(activities)
      .values(row)
      .onConflictDoUpdate({
        target: activities.id,
        set: {
          name: row.name,
          type: row.type,
          sportType: row.sportType,
          distance: row.distance,
          movingTime: row.movingTime,
          elapsedTime: row.elapsedTime,
          totalElevationGain: row.totalElevationGain,
          startDate: row.startDate,
          startDateLocal: row.startDateLocal,
          averageSpeed: row.averageSpeed,
          maxSpeed: row.maxSpeed,
          averageHeartrate: row.averageHeartrate,
          maxHeartrate: row.maxHeartrate,
          averageCadence: row.averageCadence,
          prCount: row.prCount,
          hasHeartrate: row.hasHeartrate,
          raw: row.raw,
          syncedAt: row.syncedAt,
          // Reset detailSyncedAt on update so the worker re-pulls
          // best_efforts + streams (the activity changed materially).
          detailSyncedAt: null,
        },
      })

    console.log(
      `[webhook] ${payload.aspect_type === 'create' ? 'inserted' : 'updated'} activity ${activityId} for user ${userId}`,
    )
    return
  }

  console.log(
    `[webhook] unknown activity aspect_type=${payload.aspect_type} for activity ${activityId}`,
  )
}

async function handleAthleteEvent(
  userId: number,
  payload: StravaWebhookPayload,
): Promise<void> {
  // Strava sends `updates: { authorized: "false" }` when the athlete
  // revokes the app's access. That's the ONLY athlete-level event in
  // practice — anything else is a no-op for us.
  if (
    payload.aspect_type === 'update' &&
    payload.updates?.authorized === 'false'
  ) {
    await purgeUser(userId)
    return
  }

  console.log(
    `[webhook] ignoring athlete event aspect_type=${payload.aspect_type} updates=${JSON.stringify(payload.updates)} for user ${userId}`,
  )
}

// ── Utilities ────────────────────────────────────────────────────────────

/**
 * Athlete revoked app access. Drop their tokens and activities so we
 * stop trying to call Strava on their behalf, but keep the `users` row
 * for audit (re-auth re-uses the existing user via `strava_athlete_id`).
 *
 * Tokens row goes via the FK cascade when we delete tokens explicitly.
 * Activities cascade to best_efforts + streams.
 */
async function purgeUser(userId: number): Promise<void> {
  const db = getDb()
  // Order matters only loosely — tokens has no children, activities
  // cascades to best_efforts/streams. Both are owned by user_id.
  await db.delete(tokens).where(eq(tokens.userId, userId))
  await db.delete(activities).where(eq(activities.userId, userId))
  console.log(`[webhook] purged tokens + activities for user ${userId} (deauthorized)`)
}

async function markProcessed(webhookEventId: number): Promise<void> {
  const db = getDb()
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date(), error: null })
    .where(eq(webhookEvents.id, webhookEventId))
}
