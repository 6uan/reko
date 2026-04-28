import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getRequestUrl } from '@tanstack/react-start/server'
import { useEffect } from 'react'

/** Build the Strava OAuth URL on the server (keeps client secret out of the bundle) */
const buildStravaAuthUrl = createServerFn({ method: 'GET' }).handler(
  async () => {
    const reqUrl = getRequestUrl()
    const redirectUri = `${reqUrl.protocol}//${reqUrl.host}/auth/callback`

    const url = new URL('https://www.strava.com/oauth/authorize')
    url.searchParams.set('client_id', process.env.STRAVA_CLIENT_ID!)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', 'read,activity:read_all')
    url.searchParams.set('approval_prompt', 'auto')

    return url.toString()
  },
)

export const Route = createFileRoute('/auth/strava')({
  loader: () => buildStravaAuthUrl(),
  component: StravaRedirect,
})

function StravaRedirect() {
  const url = Route.useLoaderData()

  useEffect(() => {
    window.location.href = url
  }, [url])

  return (
    <section className="flex items-center justify-center min-h-[50vh]">
      <p className="text-(--ink-2) text-sm">Redirecting to Strava…</p>
    </section>
  )
}
