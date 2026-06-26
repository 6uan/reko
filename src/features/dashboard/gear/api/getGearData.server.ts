/**
 * Gear loader (SERVER ONLY) — the user's shoes/bikes with lifetime mileage
 * (from Strava) plus a count of how many of their activities use each. Active
 * gear first, then by distance descending.
 */

import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/db/client'
import { activities, gear } from '@/db/schema'

export type GearItem = {
  id: string
  name: string
  brandName: string | null
  modelName: string | null
  nickname: string | null
  isPrimary: boolean
  retired: boolean
  /** Lifetime distance in meters, as tracked by Strava. */
  distanceMeters: number
  /** Number of this user's activities tagged with this gear. */
  activityCount: number
}

export async function getGearData(userId: number): Promise<GearItem[]> {
  const db = getDb()

  return db
    .select({
      id: gear.id,
      name: gear.name,
      brandName: gear.brandName,
      modelName: gear.modelName,
      nickname: gear.nickname,
      isPrimary: gear.isPrimary,
      retired: gear.retired,
      distanceMeters: gear.distance,
      activityCount: sql<number>`count(${activities.id})::int`,
    })
    .from(gear)
    .leftJoin(
      activities,
      and(eq(activities.gearId, gear.id), eq(activities.userId, gear.userId)),
    )
    .where(eq(gear.userId, userId))
    .groupBy(gear.id)
    .orderBy(gear.retired, desc(gear.distance))
}
