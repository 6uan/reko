import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * fetchGithubStarsCached keeps its cache in module scope, so each test
 * re-imports a fresh copy of the module via vi.resetModules() +
 * dynamic import to start from a cold cache.
 */
async function freshImport() {
  vi.resetModules()
  const mod = await import('@/features/landing/getGithubStars')
  return mod.fetchGithubStarsCached
}

const okResponse = (stars: number) =>
  new Response(JSON.stringify({ stargazers_count: stars }), { status: 200 })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('fetchGithubStarsCached', () => {
  it('returns the star count from the GitHub API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(42))
    vi.stubGlobal('fetch', fetchMock)

    const fetchStars = await freshImport()
    await expect(fetchStars()).resolves.toBe(42)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('serves from cache within the TTL without refetching', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(42))
    vi.stubGlobal('fetch', fetchMock)

    const fetchStars = await freshImport()
    await fetchStars()
    vi.advanceTimersByTime(30 * 60 * 1000)
    await expect(fetchStars()).resolves.toBe(42)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches once the TTL expires', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(42))
      .mockResolvedValueOnce(okResponse(43))
    vi.stubGlobal('fetch', fetchMock)

    const fetchStars = await freshImport()
    await fetchStars()
    vi.advanceTimersByTime(61 * 60 * 1000)
    await expect(fetchStars()).resolves.toBe(43)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('serves the stale value when a refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(okResponse(42))
      .mockRejectedValueOnce(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    const fetchStars = await freshImport()
    await fetchStars()
    vi.advanceTimersByTime(61 * 60 * 1000)
    await expect(fetchStars()).resolves.toBe(42)
  })

  it('returns null when no fetch has ever succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))

    const fetchStars = await freshImport()
    await expect(fetchStars()).resolves.toBeNull()
  })

  it('treats a non-200 response as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('rate limited', { status: 403 })),
    )

    const fetchStars = await freshImport()
    await expect(fetchStars()).resolves.toBeNull()
  })

  it('treats a malformed body as a failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ stargazers_count: 'many' }), {
          status: 200,
        }),
      ),
    )

    const fetchStars = await freshImport()
    await expect(fetchStars()).resolves.toBeNull()
  })
})
