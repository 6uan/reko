/**
 * Deterministic PRNG + distribution helpers for the demo seeder.
 *
 * Everything the seeder generates flows from one of these so that a
 * given (persona, seed) pair always produces byte-identical data —
 * reseeding in prod after a redeploy must not churn the demo.
 */

export type Rng = () => number

/** mulberry32 — tiny, fast, good-enough statistical quality for seeding. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Derive a 32-bit seed from a string (xmur3 finalizer). */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  return (h ^ (h >>> 16)) >>> 0
}

export function uniform(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min)
}

export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(uniform(rng, min, max + 1))
}

/** Standard normal via Box–Muller, scaled to (mean, sd). */
export function gaussian(rng: Rng, mean = 0, sd = 1): number {
  const u = Math.max(rng(), Number.EPSILON)
  const v = rng()
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

export function chance(rng: Rng, p: number): boolean {
  return rng() < p
}

export function pickWeighted<T>(rng: Rng, entries: Array<[T, number]>): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let roll = rng() * total
  for (const [item, weight] of entries) {
    roll -= weight
    if (roll <= 0) return item
  }
  return entries[entries.length - 1][0]
}
