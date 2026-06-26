/**
 * Index of the route point whose cumulative distance is closest to `target`
 * (meters). `distM` is ascending, so a binary search nails it in O(log n).
 */
export function nearestIndex(distM: number[], target: number): number {
  if (distM.length === 0) return 0
  if (target <= distM[0]) return 0
  if (target >= distM[distM.length - 1]) return distM.length - 1

  let lo = 0
  let hi = distM.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (distM[mid] < target) lo = mid + 1
    else hi = mid
  }
  // lo is the first index with distM[lo] >= target; pick the closer neighbour.
  if (lo > 0 && target - distM[lo - 1] < distM[lo] - target) return lo - 1
  return lo
}
