import { useEffect, useRef } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import { Avatar } from './Avatar'
import IconButton from './IconButton'
import StravaConnectButton from './StravaConnectButton'
import type { SessionData } from '@/features/auth/session'

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
            <StravaConnectButton size="sm" />
          )}
        </div>
      </div>
    </nav>
  )
}
