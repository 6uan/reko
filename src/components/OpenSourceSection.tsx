const TECH_CHIPS = ['TanStack Start', 'TypeScript', 'Tailwind', 'Postgres', 'Docker']

export default function OpenSourceSection() {
  return (
    <section id="open-source" className="border-t border-[var(--line)] py-24">
      <div className="wrap">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">
          {/* Left column — text + CTAs */}
          <div className="flex flex-col justify-center">
            <h2 className="text-[clamp(32px,4vw,52px)] font-medium tracking-tight leading-[1.08] text-[var(--ink)]">
              Plug it in,
              <br />
              host it yourself.
            </h2>

            <p className="text-[17px] leading-relaxed text-[var(--ink-2)] mt-6 max-w-[52ch]">
              Reko is a single TanStack Start app. Clone, add your Strava client
              ID, and deploy. Your activity history never leaves a box you
              control.
            </p>

            <p className="text-[17px] leading-relaxed text-[var(--ink-2)] mt-4 max-w-[52ch]">
              No accounts to make. No plan to upgrade. No analytics pixels
              watching your splits.
            </p>

            {/* Tech stack chips */}
            <div className="flex flex-wrap gap-2 mt-8">
              {TECH_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="font-mono text-xs text-[var(--ink-2)] px-2.5 py-1.5 bg-[var(--card)] border border-[var(--line)] rounded-[var(--radius-s)]"
                >
                  {chip}
                </span>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex gap-2.5 mt-8 flex-wrap">
              <a
                href="https://github.com/6uan/reko"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  className="w-[15px] h-[15px]"
                >
                  <path d="M8 .25a7.75 7.75 0 0 0-2.45 15.1c.39.07.53-.17.53-.38v-1.3c-2.15.47-2.6-1.04-2.6-1.04-.36-.9-.87-1.14-.87-1.14-.71-.49.05-.48.05-.48.78.06 1.2.8 1.2.8.7 1.2 1.83.85 2.28.65.07-.5.27-.85.5-1.04-1.72-.2-3.53-.86-3.53-3.83 0-.85.3-1.54.8-2.08-.08-.2-.35-1 .08-2.08 0 0 .65-.21 2.15.8a7.4 7.4 0 0 1 3.9 0c1.5-1.01 2.15-.8 2.15-.8.43 1.08.16 1.88.08 2.08.5.54.8 1.23.8 2.08 0 2.98-1.81 3.63-3.54 3.82.28.24.53.72.53 1.45v2.15c0 .21.14.46.54.38A7.75 7.75 0 0 0 8 .25Z" />
                </svg>
                Star on GitHub
              </a>
              <a href="#" className="btn btn-ghost">
                Read the docs
              </a>
            </div>
          </div>

          {/* Right column — Terminal mockup */}
          <div className="flex items-center">
            <div className="w-full rounded-[var(--radius-l)] border border-[#1e1d1a] overflow-hidden bg-[#0f0f0e]">
              {/* Terminal head */}
              <div className="flex items-center px-4 py-3 bg-[#0a0a09] border-b border-[#1e1d1a]">
                <div className="flex gap-[7px]">
                  <span className="w-[11px] h-[11px] rounded-full bg-[#2a2a26]" />
                  <span className="w-[11px] h-[11px] rounded-full bg-[#2a2a26]" />
                  <span className="w-[11px] h-[11px] rounded-full bg-[#2a2a26]" />
                </div>
                <div className="flex-1 text-center font-mono text-[12px] text-[#5c5952]">
                  ~/reko
                </div>
                <div className="w-[54px]" />
              </div>

              {/* Terminal body */}
              <div className="p-5 font-mono text-[13px] leading-[1.75] overflow-x-auto">
                <div>
                  <span className="text-[#7a7669]">$ </span>
                  <span className="text-[#f3f0e5]">
                    git clone github.com/reko-run/reko
                  </span>
                </div>
                <div className="text-[#8a8679]">
                  Cloning into &apos;reko&apos;... done.
                </div>
                <div className="mt-2">
                  <span className="text-[#7a7669]">$ </span>
                  <span className="text-[#f3f0e5]">cp .env.example .env</span>
                </div>
                <div>
                  <span className="text-[#7a7669]">$ </span>
                  <span className="text-[#f3f0e5]">
                    echo &quot;STRAVA_CLIENT_ID=...&quot; &gt;&gt; .env
                  </span>
                </div>
                <div className="mt-2">
                  <span className="text-[#7a7669]">$ </span>
                  <span className="text-[#f3f0e5]">docker compose up</span>
                </div>
                <div className="text-[#8a8679]">
                  reko{'  '}&brvbar;{' '}
                  <span className="text-[#9ec98f]">&check;</span> ready on :3000
                </div>
                <div className="text-[#8a8679]">
                  reko{'  '}&brvbar;{' '}
                  <span className="text-[#9ec98f]">&check;</span> strava oauth
                  configured
                </div>
                <div className="text-[#8a8679]">
                  reko{'  '}&brvbar; synced{' '}
                  <span className="text-[var(--accent)]">412</span> activities
                </div>
                <div>
                  <span className="text-[#7a7669]">$ </span>
                  <span className="text-[#f3f0e5]">
                    open http://localhost:3000
                  </span>
                  <span className="terminal-cursor" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
