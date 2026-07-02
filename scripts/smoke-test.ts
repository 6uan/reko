/**
 * Post-build smoke test: boot the production server exactly as the
 * runtime image does and require a healthy `/`.
 *
 * Exists because `vite build` can succeed while the server bundle is
 * broken — rolldown in vite 8.0.10 emitted a cyclic chunk pair whose
 * interop helper was undefined at eval time, and every SSR request
 * 500'd (July 2026 outage). The Dockerfile runs this in the build
 * stage, so a broken bundle fails the image build and Coolify keeps
 * the previous container.
 *
 * Needs no env: the landing page renders without SESSION_SECRET or
 * DATABASE_URL by design (its loaders degrade to null).
 *
 * Usage (after `pnpm build`):
 *   node --experimental-strip-types scripts/smoke-test.ts
 */

import { spawn } from 'node:child_process'

const PORT = process.env.SMOKE_PORT ?? '3210'

const server = spawn(
  'node_modules/.bin/srvx',
  ['--prod', '-s', '../client', '--port', PORT, 'dist/server/server.js'],
  {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: ['ignore', 'inherit', 'inherit'],
  },
)

let serverExited = false
server.on('exit', () => {
  serverExited = true
})

function fail(msg: string): never {
  console.error(`[smoke] FAIL: ${msg}`)
  server.kill('SIGKILL')
  process.exit(1)
}

let res: Response | null = null
for (let attempt = 0; attempt < 60 && !res; attempt++) {
  if (serverExited) fail('server process exited before answering')
  try {
    res = await fetch(`http://127.0.0.1:${PORT}/`)
  } catch {
    await new Promise((r) => setTimeout(r, 500))
  }
}

if (!res) fail(`server did not answer on :${PORT} within 30s`)
const body = await res.text()
if (res.status !== 200) {
  fail(`GET / responded ${res.status} — server bundle is likely broken`)
}
if (!body.includes('</html>')) {
  fail('GET / returned 200 but the document is incomplete')
}

console.log('[smoke] GET / → 200, full document rendered')
server.kill('SIGKILL')
process.exit(0)
