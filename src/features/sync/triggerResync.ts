/**
 * Server fn called by the ResyncButton in the dashboard sidebar.
 * Thin wrapper around enqueueBackfill — gated by session.
 */

import { createServerFn } from '@tanstack/react-start'
import { readSessionOnServer } from '@/features/auth/session'
import { enqueueBackfill, type EnqueueResult } from './api/backfillActivities.server'

export const triggerResync = createServerFn({ method: 'POST' }).handler(
  async (): Promise<EnqueueResult> => {
    const session = await readSessionOnServer()
    const userId = session?.userId
    if (!userId) {
      throw new Error('Not authenticated')
    }
    return enqueueBackfill(userId)
  },
)
