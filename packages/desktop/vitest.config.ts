import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/unit/specs/**/*.spec.ts'],
    globals: true,
    // Coverage is scoped to the logic-bearing GitHub feature modules (main
    // process + Pinia store), which are fully unit-tested. The Vue SFCs are
    // presentation and are validated by typecheck + lint + the plan's manual
    // smoke test (networked e2e is deferred). Enable with `--coverage`.
    coverage: {
      provider: 'v8',
      include: ['src/main/github/**', 'src/renderer/src/store/github.ts'],
      reporter: ['text', 'text-summary'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      common: resolve(__dirname, 'src/common'),
      muya: resolve(__dirname, '../muyajs'),
      '@shared': resolve(__dirname, 'src/shared'),
      main_renderer: resolve(__dirname, 'src/main')
    },
    extensions: ['.mjs', '.ts', '.js', '.json']
  }
})
