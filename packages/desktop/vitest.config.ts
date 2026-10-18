import { defineConfig } from 'vitest/config'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Node 25 turns on its own Web Storage, whose `localStorage` global shadows
// jsdom's, so specs that use storage fail. Node 20 has no such flag. Probe the
// positive spelling: Node 25 accepts `--no-experimental-webstorage` but lists
// only `--experimental-webstorage` in `allowedNodeEnvironmentFlags`.
const nodeWebStorageOff = process.allowedNodeEnvironmentFlags.has('--experimental-webstorage')
  ? ['--no-experimental-webstorage']
  : []

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['test/unit/specs/**/*.spec.ts'],
    globals: true,
    execArgv: nodeWebStorageOff
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      common: resolve(__dirname, 'src/common'),
      '@shared': resolve(__dirname, 'src/shared'),
      main_renderer: resolve(__dirname, 'src/main')
    },
    extensions: ['.mjs', '.ts', '.js', '.json']
  }
})
