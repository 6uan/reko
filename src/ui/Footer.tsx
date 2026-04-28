export default function Footer() {
  return (
    <footer className="border-t border-(--line) pt-12 pb-10 max-sm:pt-8 max-sm:pb-7 bg-(--bg-elev)">
      <div className="wrap flex items-center justify-between gap-6 flex-wrap max-sm:flex-col max-sm:items-center max-sm:gap-4 max-sm:text-center">
        <div className="flex items-center gap-5 flex-wrap max-sm:flex-col max-sm:items-center max-sm:gap-2">
          <div className="flex items-center gap-2.5 font-medium text-(--ink) text-[15px]">
            <span className="brand-mark"><span>R</span></span>
            Reko
          </div>
          <span className="font-mono text-[11px] text-(--ink-4)">&copy; 2026 &middot; MIT licensed</span>
        </div>
        <div className="flex gap-4.5 max-sm:gap-3.5 text-[13px]">
          <a href="https://github.com/6uan/reko" target="_blank" rel="noreferrer" className="text-(--ink-3) no-underline transition-colors duration-150 ease-in-out hover:text-(--ink)">GitHub</a>
          <a href="#" className="text-(--ink-3) no-underline transition-colors duration-150 ease-in-out hover:text-(--ink)">Docs</a>
          <a href="#" className="text-(--ink-3) no-underline transition-colors duration-150 ease-in-out hover:text-(--ink)">Privacy</a>
          <a href="#" className="text-(--ink-3) no-underline transition-colors duration-150 ease-in-out hover:text-(--ink)">Changelog</a>
        </div>
        <a
          href="https://www.strava.com"
          target="_blank"
          rel="noreferrer"
          aria-label="Powered by Strava"
          className="inline-flex items-center px-3.5 py-2 bg-(--card) border border-(--line) rounded-[10px] no-underline transition-colors duration-150 ease-in-out hover:bg-(--card-2)"
        >
          {/* Light mode: orange-on-cream lockup */}
          <img
            src="/strava/api_logo_pwrdBy_strava_horiz_orange.svg"
            alt="Powered by Strava"
            width={365}
            height={37}
            className="block h-4.5 w-auto dark:hidden"
          />
          {/* Dark mode: white lockup */}
          <img
            src="/strava/api_logo_pwrdBy_strava_horiz_white.svg"
            alt=""
            aria-hidden="true"
            width={365}
            height={37}
            className="hidden h-4.5 w-auto dark:block"
          />
        </a>
      </div>
    </footer>
  )
}
