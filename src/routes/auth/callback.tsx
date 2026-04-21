import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { exchangeCodeForTokens } from '../../lib/strava'
import { setSession } from '../../lib/session'

/** Exchange auth code → tokens → encrypted session cookie */
const handleStravaCallback = createServerFn({ method: 'POST' })
  .inputValidator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const tokens = await exchangeCodeForTokens(data.code)

    await setSession({
      data: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
        athleteId: tokens.athlete.id,
        firstname: tokens.athlete.firstname,
        lastname: tokens.athlete.lastname,
        profile: tokens.athlete.profile,
      },
    })
  })

export const Route = createFileRoute('/auth/callback')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: search.code as string | undefined,
    error: search.error as string | undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (search.error || !search.code) {
      throw redirect({ to: '/' })
    }

    await handleStravaCallback({ data: { code: search.code } })
    throw redirect({ to: '/dashboard' })
  },
  component: () => null,
})
