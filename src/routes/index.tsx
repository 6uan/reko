import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <main className="wrap" style={{ paddingTop: '120px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '48px', fontWeight: 500, letterSpacing: '-0.035em' }}>
        Reko
      </h1>
      <p style={{ color: 'var(--ink-2)', marginTop: '8px' }}>
        Every run, measured.
      </p>
    </main>
  )
}
