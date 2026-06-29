import { describe, expect, it } from 'vitest'
import { formatPace as formatSharedPace } from '@/lib/strava'
import { formatPace as formatRecordsPace } from '@/features/dashboard/records/components/helpers'

describe('pace formatting', () => {
  it('carries rounded seconds into the minute instead of rendering :60', () => {
    expect(formatSharedPace(539.9)).toBe('9:00')
    expect(formatRecordsPace(539.9)).toBe('9:00')
  })
})
