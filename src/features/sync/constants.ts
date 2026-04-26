/**
 * Shared constants for the sync feature. Lives in its own file so the
 * server-side guard in backfillActivities and the client-side ring in
 * ResyncButton can't drift apart — a longer client cooldown is harmless
 * (over-conservative), but a shorter one would let the button enable
 * before the server is willing to accept the call, producing silent
 * failures.
 */

export const RESYNC_COOLDOWN_MS = 30_000
