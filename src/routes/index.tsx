import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">
            <span className="dot" />
            <span>v0.1 &middot; open-source</span>
            <span className="sep">&middot;</span>
            <span>self-hosted</span>
          </div>

          <h1 className="hero-title">
            Every run,<br />
            <em>measured.</em>
          </h1>

          <p className="hero-sub">
            Reko plugs into your Strava and shows the progress Strava doesn't.{' '}
            <strong>Personal records across every distance,</strong> leaderboards
            of your own efforts, and pace trends you can actually read.
            Self-hosted. Your data stays yours.
          </p>

          <div className="hero-ctas">
            <a href="#" className="btn btn-primary">
              <span className="strava-dot" />
              Connect with Strava
            </a>
            <a
              href="https://github.com/6uan/reko"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              <svg viewBox="0 0 16 16" fill="currentColor" width="15" height="15">
                <path d="M8 .25a7.75 7.75 0 0 0-2.45 15.1c.39.07.53-.17.53-.38v-1.3c-2.15.47-2.6-1.04-2.6-1.04-.36-.9-.87-1.14-.87-1.14-.71-.49.05-.48.05-.48.78.06 1.2.8 1.2.8.7 1.2 1.83.85 2.28.65.07-.5.27-.85.5-1.04-1.72-.2-3.53-.86-3.53-3.83 0-.85.3-1.54.8-2.08-.08-.2-.35-1 .08-2.08 0 0 .65-.21 2.15.8a7.4 7.4 0 0 1 3.9 0c1.5-1.01 2.15-.8 2.15-.8.43 1.08.16 1.88.08 2.08.5.54.8 1.23.8 2.08 0 2.98-1.81 3.63-3.54 3.82.28.24.53.72.53 1.45v2.15c0 .21.14.46.54.38A7.75 7.75 0 0 0 8 .25Z" />
              </svg>
              View on GitHub
            </a>
          </div>

          <div className="hero-meta">
            <span className="pill">MIT</span>
            <span>self-hosted &middot; Docker or Coolify</span>
          </div>
        </div>
      </section>
    </>
  )
}
