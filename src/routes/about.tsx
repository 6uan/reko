import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="wrap pt-[72px] pb-[72px]">
      <h1 className="text-[32px] font-medium tracking-tight">
        About
      </h1>
      <p className="text-[var(--ink-2)] mt-3 max-w-[52ch] leading-relaxed">
        Reko is an open-source running analytics dashboard that connects to your
        Strava account to track personal records, rank your fastest efforts across
        distances, and visualize your progress over time.
      </p>
    </main>
  )
}
