import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { readFileSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const markdownPlugin = (): Plugin => ({
  name: 'vite-plugin-markdown',
  transform(_code, id) {
    if (id.endsWith('.md')) {
      const content = readFileSync(id, 'utf-8')
      return {
        code: `export default ${JSON.stringify(content)}`,
        map: null
      }
    }
  }
})

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    markdownPlugin(),
    svgr({
      svgrOptions: {
        icon: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      'assets': resolve(__dirname, './src/assets'),
      'markdown': resolve(__dirname, './src/markdowns'),
      'themes': resolve(__dirname, './src/themes'),
    },
  },
  server: {
    port: 8080,
    open: true,
  },
  build: {
    outDir: 'build',
  },
  assetsInclude: ['**/*.md']
})
