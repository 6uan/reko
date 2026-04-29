/**
 * Server fn called by the ResyncButton in the dashboard sidebar.
 * Thin wrapper around enqueueBackfill — gated by session.
 */

import { createServerFn } from '@tanstack/react-start'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import { sessionConfig, type SessionData } from '../auth/session'
import { enqueueBackfill, type EnqueueResult } from './backfillActivities.server'

export const triggerResync = createServerFn({ method: 'POST' }).handler(
  async (): Promise<EnqueueResult> => {
    const session = await frameworkGetSession<SessionData>(sessionConfig)
    const userId = session.data.userId
    if (!userId) {
      throw new Error('Not authenticated')
    }
    return enqueueBackfill(userId)
  },
)
