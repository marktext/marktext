import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/unit/specs/**/*.spec.{ts,js}'],
    globals: true,
    reporters: ['verbose'],
    pool: 'forks',
    // Make common/i18n.ts locale loading work from cwd (same as dev/perf mode)
    env: { PERF_TESTING: 'true' },
    coverage: {
      provider: 'v8',
      include: ['src/common/**', 'src/renderer/src/**', 'src/muya/lib/**'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/__tests__/**',
        'src/muya/lib/parser/render/plantuml.js'
      ],
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: 'coverage'
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      common: resolve(__dirname, 'src/common'),
      muya: resolve(__dirname, 'src/muya'),
      '@shared': resolve(__dirname, 'src/shared'),
      main_renderer: resolve(__dirname, 'src/main')
    },
    extensions: ['.mjs', '.ts', '.js', '.json']
  },
  server: {
    deps: {
      // Force minimatch (CJS v3) through Vite's bundler so the named
      // import { minimatch } in src/common/filesystem/paths.ts resolves
      // correctly (esbuild handles CJS→ESM interop; bare Node.js does not).
      inline: ['minimatch']
    }
  }
})
