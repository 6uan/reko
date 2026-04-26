import { useEffect, useRef } from 'react'
import { Link } from '@tanstack/react-router'
import ThemeToggle from './ThemeToggle'
import type { SessionData } from '../features/auth/session'

export default function Header({
  session,
}: {
  session: SessionData | null
}) {
  const navRef = useRef<HTMLElement>(null)

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
      className="site sticky top-0 z-50 border-b border-transparent transition-[background,backdrop-filter,border-color] duration-200 ease-in-out px-[18px] sm:px-7"
      ref={navRef}
    >
      <div className="flex items-center justify-between max-w-[1240px] mx-auto py-3.5 sm:py-[18px]">
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 font-semibold text-lg tracking-tight text-[var(--ink)] no-underline"
        >
          <span className="brand-mark">
            <span>R</span>
          </span>
          <span>Reko</span>
        </Link>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Logged-out nav links */}
          {!session && (
            <>
              <a
                href="#open-source"
                className="site-nav-link hide-m inline-flex items-center gap-[7px] text-[var(--ink-2)] no-underline text-sm font-medium px-3.5 py-2 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-[var(--ink)]"
              >
                Open source
              </a>
              <a
                href="https://github.com/6uan/reko"
                target="_blank"
                rel="noreferrer"
                className="site-nav-link hide-m inline-flex items-center gap-[7px] text-[var(--ink-2)] no-underline text-sm font-medium px-3.5 py-2 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-[var(--ink)]"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-[15px] h-[15px]"
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
              className="site-nav-link hide-m inline-flex items-center gap-[7px] text-[var(--ink-2)] no-underline text-sm font-medium px-3.5 py-2 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-[var(--ink)]"
            >
              Dashboard
            </Link>
          )}

          <ThemeToggle />

          {session ? (
            <Link
              to="/profile"
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink-2)] no-underline px-2 py-1.5 rounded-[10px] transition-[background,color] duration-150 ease-in-out hover:bg-[rgba(20,20,20,0.05)] hover:text-[var(--ink)]"
            >
              <img
                src={session.profile}
                alt={session.firstname}
                className="w-7 h-7 rounded-full border border-[var(--line)]"
              />
              <span className="hide-m">{session.firstname}</span>
            </Link>
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
