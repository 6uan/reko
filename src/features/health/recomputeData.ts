/**
 * Client-callable server fn — runs the derived-data backfill (splits +
 * HR zone efforts) for the current authenticated user. Wired to the
 * "Recompute" button on the profile page so self-hosters don't need to
 * ssh and run scripts after deploys / algorithm updates.
 */

import { createServerFn } from '@tanstack/react-start'
import { getSession as frameworkGetSession } from '@tanstack/react-start/server'
import { sessionConfig, type SessionData } from '@/features/auth/session'
import {
  backfillComputedData,
  type RecomputeResult,
} from './api/backfillComputed.server'

export type { RecomputeResult } from './api/backfillComputed.server'

export const recomputeData = createServerFn({ method: 'POST' }).handler(
  async (): Promise<RecomputeResult> => {
    const session = await frameworkGetSession<SessionData>(sessionConfig)
    const userId = session.data.userId
    if (!userId) {
      throw new Error('Not authenticated')
    }
    return backfillComputedData(userId)
  },
)
