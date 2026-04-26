import { createFileRoute } from '@tanstack/react-router'
import DashboardMockup from '../features/landing/DashboardMockup'
import StatsStrip from '../features/landing/StatsStrip'
import OpenSourceSection from '../features/landing/OpenSourceSection'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <>
      <section className="pt-[72px] pb-10 max-sm:pt-10 relative overflow-x-hidden">
        <div className="wrap">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 pl-2 bg-[var(--card)] border border-[var(--line)] rounded-full font-mono text-xs font-medium text-[var(--ink-2)] shadow-[var(--shadow-s)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_0_3px_rgba(var(--accent-glow),0.18)]" />
            <span>v0.1 &middot; open-source</span>
            <span className="text-[var(--ink-4)]">&middot;</span>
            <span>self-hosted</span>
          </div>

          <h1 className="text-[clamp(44px,7.5vw,92px)] leading-[0.98] tracking-[-0.035em] font-medium mt-[22px] text-[var(--ink)] max-w-[14ch]">
            Every run,<br />
            <em className="not-italic text-[var(--accent)] font-medium">measured.</em>
          </h1>

          <p className="text-[19px] leading-normal text-[var(--ink-2)] mt-6 max-w-[52ch] tracking-tight">
            Reko plugs into your Strava and shows the progress Strava doesn't.{' '}
            <strong className="text-[var(--ink)] font-medium">Personal records across every distance,</strong> leaderboards
            of your own efforts, and pace trends you can actually read.
            Self-hosted. Your data stays yours.
          </p>

          <div className="flex gap-2.5 mt-8 flex-wrap items-center max-sm:[&_.btn]:flex-1">
            <a
              href="/auth/strava"
              aria-label="Connect with Strava"
              className="inline-block transition-transform duration-150 ease-out hover:-translate-y-0.5 max-sm:flex-1"
            >
              <img
                src="/strava/btn_strava_connect_with_orange@2x.png"
                srcSet="/strava/btn_strava_connect_with_orange.png 1x, /strava/btn_strava_connect_with_orange@2x.png 2x"
                alt="Connect with Strava"
                width={237}
                height={48}
                className="block h-12 w-auto max-sm:w-full max-sm:h-auto"
              />
            </a>
            <a
              href="https://github.com/6uan/reko"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-[15px] h-[15px]">
                <path d="M8 .25a7.75 7.75 0 0 0-2.45 15.1c.39.07.53-.17.53-.38v-1.3c-2.15.47-2.6-1.04-2.6-1.04-.36-.9-.87-1.14-.87-1.14-.71-.49.05-.48.05-.48.78.06 1.2.8 1.2.8.7 1.2 1.83.85 2.28.65.07-.5.27-.85.5-1.04-1.72-.2-3.53-.86-3.53-3.83 0-.85.3-1.54.8-2.08-.08-.2-.35-1 .08-2.08 0 0 .65-.21 2.15.8a7.4 7.4 0 0 1 3.9 0c1.5-1.01 2.15-.8 2.15-.8.43 1.08.16 1.88.08 2.08.5.54.8 1.23.8 2.08 0 2.98-1.81 3.63-3.54 3.82.28.24.53.72.53 1.45v2.15c0 .21.14.46.54.38A7.75 7.75 0 0 0 8 .25Z" />
              </svg>
              View on GitHub
            </a>
          </div>

          <div className="mt-[22px] flex items-center gap-3.5 font-mono text-xs text-[var(--ink-3)]">
            <span className="px-2 py-1 rounded-md bg-[var(--card-2)] border border-[var(--line-2)]">MIT</span>
            <span>self-hosted &middot; Docker or Coolify</span>
          </div>

          <DashboardMockup />
        </div>
      </section>
      <StatsStrip />
      <OpenSourceSection />
    </>
  )
}
