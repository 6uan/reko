import { Link } from '@tanstack/react-router'

export default function NotFound() {
  return (
    <main className="wrap pt-30 pb-30 max-sm:pt-16 max-sm:pb-16">
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-(--ink-4)">
        404
      </div>
      <h1 className="text-[clamp(36px,5vw,56px)] leading-[1.05] tracking-tight font-medium mt-3 text-(--ink) max-w-[18ch]">
        That route doesn&rsquo;t exist.
      </h1>
      <p className="text-[17px] leading-relaxed text-(--ink-2) mt-5 max-w-[52ch]">
        The page you&rsquo;re looking for has been moved, renamed, or never
        existed in the first place.
      </p>
      <div className="flex gap-2.5 mt-8 flex-wrap">
        <Link to="/" className="btn btn-primary">
          Back to home
        </Link>
        <a
          href="https://github.com/6uan/reko/issues"
          target="_blank"
          rel="noreferrer"
          className="btn btn-ghost"
        >
          Report a broken link
        </a>
      </div>
    </main>
  )
}
