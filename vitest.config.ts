/**
 * Vitest config — intentionally separate from vite.config.ts so unit tests
 * run in a plain Node environment without the TanStack Start plugin (route
 * codegen / SSR transforms). The pure metrics live behind the `@/` alias,
 * so we mirror the tsconfig path aliases here.
 */
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': src,
      '#': src,
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
