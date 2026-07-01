/**
 * Server-side helper behind getLandingStats.
 *
 * Star count comes from the public GitHub API, cached in-memory for an
 * hour — a busy landing page costs at most one GitHub request per hour
 * (the unauthenticated limit is 60/hr per IP). If a refresh fails the
 * last known value is served indefinitely; `null` means no fetch has
 * ever succeeded (StatsStrip renders a dash instead of a fake zero).
 */

const REPO = '6uan/reko'
const TTL_MS = 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 4000

let cache: { stars: number; fetchedAt: number } | null = null

export async function fetchGithubStarsCached(): Promise<number | null> {
  if (cache && Date.now() - cache.fetchedAt < TTL_MS) return cache.stars

  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'reko-landing',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })
    if (!res.ok) throw new Error(`GitHub API responded ${res.status}`)

    const repo = (await res.json()) as { stargazers_count?: unknown }
    if (typeof repo.stargazers_count !== 'number') {
      throw new Error('GitHub API response missing stargazers_count')
    }

    cache = { stars: repo.stargazers_count, fetchedAt: Date.now() }
    return cache.stars
  } catch {
    return cache?.stars ?? null
  }
}
