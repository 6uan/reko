/**
 * Client-callable server fn — runs the derived-data backfill (splits +
 * HR zone efforts) for the current authenticated user. Wired to the
 * "Recompute" button on the profile page so self-hosters don't need to
 * ssh and run scripts after deploys / algorithm updates.
 */

import { createServerFn } from '@tanstack/react-start'
import { requireWritableSession } from '@/features/auth/session.server'
import {
  backfillComputedData,
  type RecomputeResult,
} from './api/backfillComputed.server'

export type { RecomputeResult } from './api/backfillComputed.server'

export const recomputeData = createServerFn({ method: 'POST' }).handler(
  async (): Promise<RecomputeResult> => {
    // Throws for anonymous AND demo sessions — demo data is immutable.
    const session = await requireWritableSession()
    return backfillComputedData(session.userId)
  },
)
