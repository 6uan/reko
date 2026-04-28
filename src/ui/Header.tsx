import { useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { Avatar } from './Avatar'
import IconButton from './IconButton'
import type { SessionData } from '../features/auth/session'

export default function Header({
  session,
}: {
  session: SessionData | null
}) {
  const navRef = useRef<HTMLElement>(null)
  // Imperative navigate for the profile IconButton — links can't be
  // nested in <button>, and we want the profile entry to literally
  // reuse the IconButton component (matching the ThemeToggle's chrome)
  // rather than re-styling a Link.
  const navigate = useNavigate()

  useEffect(() => {
    function onScroll() {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 8)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className="site sticky top-0 z-50 border-b border-transparent transition-[background,backdrop-filter,border-color] duration-200 ease-in-out px-4.5 sm:px-7"
      ref={navRef}
    >
      <div className="flex items-center justify-between max-w-310 mx-auto py-3.5 sm:py-4.5">
        {/* Brand mark — Tilt Warp display sans, sized to feel
            substantial alongside the 36px IconButtons on the right so it
            reads as a logo rather than a nav link. `leading-none` keeps
            it visually centred in the header row without padding the
            line-height. */}
        <Link
          to="/"
          className="font-display text-[32px] leading-none text-(--ink) no-underline"
        >
          Reko
        </Link>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Logged-out nav links */}
          {!session && (
            <>
              <a
                href="#open-source"
                className="site-nav-link hide-m inline-flex items-center gap-1.75 text-(--ink-2) no-underline text-sm font-medium px-3.5 py-2 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-(--ink)"
              >
                Open source
              </a>
              <a
                href="https://github.com/6uan/reko"
                target="_blank"
                rel="noreferrer"
                className="site-nav-link hide-m inline-flex items-center gap-1.75 text-(--ink-2) no-underline text-sm font-medium px-3.5 py-2 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-(--ink)"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path d="M8 .25a7.75 7.75 0 0 0-2.45 15.1c.39.07.53-.17.53-.38v-1.3c-2.15.47-2.6-1.04-2.6-1.04-.36-.9-.87-1.14-.87-1.14-.71-.49.05-.48.05-.48.78.06 1.2.8 1.2.8.7 1.2 1.83.85 2.28.65.07-.5.27-.85.5-1.04-1.72-.2-3.53-.86-3.53-3.83 0-.85.3-1.54.8-2.08-.08-.2-.35-1 .08-2.08 0 0 .65-.21 2.15.8a7.4 7.4 0 0 1 3.9 0c1.5-1.01 2.15-.8 2.15-.8.43 1.08.16 1.88.08 2.08.5.54.8 1.23.8 2.08 0 2.98-1.81 3.63-3.54 3.82.28.24.53.72.53 1.45v2.15c0 .21.14.46.54.38A7.75 7.75 0 0 0 8 .25Z" />
                </svg>
                GitHub
              </a>
            </>
          )}

          {/* Logged-in nav link */}
          {session && (
            <Link
              to="/dashboard"
              className="site-nav-link hide-m inline-flex items-center gap-1.75 text-(--ink-2) no-underline text-sm font-medium px-3.5 py-2 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-(--ink)"
            >
              Dashboard
            </Link>
          )}

          <ThemeToggle />

          {session ? (
            // Profile entry: one IconButton holding the avatar and the
            // name side by side. IconButton's `min-w-9 sm:px-2 gap-2`
            // lets it grow into a pill once a label child is present.
            // Name shows at every breakpoint — if the header ever gets
            // crowded on tiny viewports we can re-introduce a responsive
            // hide on the span (e.g. `max-[360px]:hidden`).
            <IconButton
              aria-label="Profile"
              onClick={() => navigate({ to: '/profile' })}
            >
              <Avatar name={session.firstname} size="xs" />
              <span className="text-sm font-medium pr-1">
                {session.firstname}
              </span>
            </IconButton>
          ) : (
            <Link
              to="/auth/strava"
              aria-label="Connect with Strava"
              className="inline-block transition-transform duration-150 ease-out hover:-translate-y-0.5"
            >
              <img
                src="/strava/btn_strava_connect_with_orange.png"
                srcSet="/strava/btn_strava_connect_with_orange.png 1x, /strava/btn_strava_connect_with_orange@2x.png 2x"
                alt="Connect with Strava"
                width={158}
                height={32}
                className="block h-8 w-auto"
              />
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}
