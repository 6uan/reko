import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="wrap" style={{ paddingTop: '72px', paddingBottom: '72px' }}>
      <h1 style={{ fontSize: '32px', fontWeight: 500, letterSpacing: '-0.025em' }}>
        About
      </h1>
      <p style={{ color: 'var(--ink-2)', marginTop: '12px', maxWidth: '52ch', lineHeight: 1.6 }}>
        Reko is an open-source running analytics dashboard that connects to your
        Strava account to track personal records, rank your fastest efforts across
        distances, and visualize your progress over time.
      </p>
    </main>
  )
}
