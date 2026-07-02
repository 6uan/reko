/**
 * Server fn called by the ResyncButton in the dashboard sidebar.
 * Thin wrapper around enqueueBackfill — gated by session.
 */

import { createServerFn } from '@tanstack/react-start'
import { requireWritableSession } from '@/features/auth/session.server'
import { enqueueBackfill, type EnqueueResult } from './api/backfillActivities.server'

export const triggerResync = createServerFn({ method: 'POST' }).handler(
  async (): Promise<EnqueueResult> => {
    // Throws for anonymous AND demo sessions — demo must never reach Strava.
    const session = await requireWritableSession()
    return enqueueBackfill(session.userId)
  },
)
