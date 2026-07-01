import { defineConfig } from 'vite'
import dotenv from 'dotenv'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite re-runs this config on every server restart — including the restart
// it triggers when .env changes — but nothing refreshes process.env for SSR
// code, so env edits silently didn't apply until a full Ctrl+C. `override`
// matters: without it dotenv won't replace values captured at first load.
// (No .env in prod builds — Coolify injects env directly — so this no-ops.)
dotenv.config({ override: true })

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
  server: {
    // Bind all interfaces so other devices on the LAN / tailnet can reach it,
    // not just localhost.
    host: true,
    port: 3000,
    // Vite allows localhost + IP-literal hosts by default; these entries cover
    // access by *hostname* — `*.lan` on the LAN today, `*.ts.net` once
    // Tailscale is installed. Without them Vite returns "host not allowed".
    allowedHosts: ['.lan', '.ts.net'],
    // HMR host/port are auto-inferred from the browser URL on a direct
    // (no-proxy) connection, so no hmr override is needed for access by
    // LAN IP or by hostname.
  },
})

export default config
