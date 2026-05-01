import { IoLogoGithub } from 'react-icons/io'

const TECH_CHIPS = ['TanStack Start', 'TypeScript', 'Tailwind', 'Postgres', 'Docker']

export default function OpenSourceSection() {
  return (
    <section id="open-source" className="border-t border-(--line) py-24">
      <div className="wrap">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20">
          {/* Left column — text + CTAs */}
          <div className="flex flex-col justify-center">
            <h2 className="text-[clamp(32px,4vw,52px)] font-medium tracking-tight leading-[1.08] text-(--ink)">
              Plug it in,
              <br />
              host it yourself.
            </h2>

            <p className="text-[17px] leading-relaxed text-(--ink-2) mt-6 max-w-[52ch]">
              Reko is a single TanStack Start app. Clone, add your Strava client
              ID, and deploy. Your activity history never leaves a box you
              control.
            </p>

            <p className="text-[17px] leading-relaxed text-(--ink-2) mt-4 max-w-[52ch]">
              No accounts to make. No plan to upgrade. No analytics pixels
              watching your splits.
            </p>

            {/* Tech stack chips */}
            <div className="flex flex-wrap gap-2 mt-8">
              {TECH_CHIPS.map((chip) => (
                <span
                  key={chip}
                  className="font-mono text-xs text-(--ink-2) px-2.5 py-1.5 bg-(--card) border border-(--line) rounded-(--radius-s)"
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
                <IoLogoGithub size={18} />
                Star on GitHub
              </a>
              <a href="#" className="btn btn-ghost">
                Read the docs
              </a>
            </div>
          </div>

          {/* Right column — Terminal mockup */}
          <div className="flex items-center">
            <div className="w-full rounded-(--radius-l) border border-[#1e1d1a] overflow-hidden bg-[#0f0f0e]">
              {/* Terminal head */}
              <div className="flex items-center px-4 py-3 bg-[#0a0a09] border-b border-[#1e1d1a]">
                <div className="flex gap-1.75">
                  <span className="w-2.75 h-2.75 rounded-full bg-[#2a2a26]" />
                  <span className="w-2.75 h-2.75 rounded-full bg-[#2a2a26]" />
                  <span className="w-2.75 h-2.75 rounded-full bg-[#2a2a26]" />
                </div>
                <div className="flex-1 text-center font-mono text-[12px] text-[#5c5952]">
                  ~/reko
                </div>
                <div className="w-13.5" />
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
                  <span className="text-(--accent)">412</span> activities
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
