/**
 * Shared aggregation utilities for grouping activities by time period.
 */

import { getMonday } from "./dates";

/** A single weekly bucket after aggregation. */
export type WeekBucket = {
  week: string; // ISO date string of the Monday (e.g. "2026-04-07")
  label: string; // Short label for charts (e.g. "4/7")
  avg: number; // Aggregated average of values
  count: number; // Number of items in this bucket
};

/**
 * Group items by week (Monday-based) and compute the average value per week.
 *
 * @param items - Array of items to group
 * @param dateFn - Extracts a date string from each item
 * @param valueFn - Extracts the numeric value to average (return null/undefined to skip)
 */
export function groupByWeek<T>(
  items: T[],
  dateFn: (item: T) => string,
  valueFn: (item: T) => number | null | undefined,
  { round = false }: { round?: boolean } = {},
): WeekBucket[] {
  const buckets = new Map<string, number[]>();

  for (const item of items) {
    const val = valueFn(item);
    if (val == null || val <= 0) continue;
    const key = getMonday(new Date(dateFn(item)))
      .toISOString()
      .slice(0, 10);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(val);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, vals]) => {
      const d = new Date(week);
      return {
        week,
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        avg: round
          ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length)
          : vals.reduce((s, v) => s + v, 0) / vals.length,
        count: vals.length,
      };
    });
}

/**
 * Compute a trend delta: average of the second half minus average of the first half.
 * Returns 0 if fewer than 2 buckets.
 */
export function trendDelta(buckets: WeekBucket[]): number {
  if (buckets.length < 2) return 0;
  const mid = Math.ceil(buckets.length / 2);
  const firstAvg = buckets.slice(0, mid).reduce((s, b) => s + b.avg, 0) / mid;
  const lastAvg =
    buckets.slice(mid).reduce((s, b) => s + b.avg, 0) / (buckets.length - mid);
  return Math.round(lastAvg - firstAvg);
}
