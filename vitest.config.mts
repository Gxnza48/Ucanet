import { defineConfig } from 'vitest/config'
import path from 'node:path'

// PART 25: Vitest cubre lógica pura (Zod, slugs, nanoid, orden del feed, karma).
// Las políticas RLS se prueban con pgTAP; los flujos, con Playwright.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['{lib,features,components}/**/*.test.ts'],
    exclude: ['node_modules/**', '.next/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
