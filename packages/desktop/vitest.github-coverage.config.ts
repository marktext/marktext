import { defineConfig, mergeConfig } from 'vitest/config'
import baseConfig from './vitest.config'

// Coverage gate for the GitHub integration's logic modules (main process +
// Pinia store; the Vue SFCs are presentation and covered by typecheck/lint
// and the manual smoke test). Kept out of the default vitest.config.ts so an
// ordinary `vitest run --coverage` — especially a single-spec run — isn't
// failed by feature-scoped thresholds. Run via `pnpm run coverage:github`.
export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
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
    }
  })
)
