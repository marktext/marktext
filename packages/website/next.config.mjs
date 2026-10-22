import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config = {
  reactStrictMode: true,
  output: 'standalone',
  outputFileTracingRoot: resolve(__dirname, '../..'),
  images: {
    unoptimized: true
  },
  webpack(config) {
    // Documentation charts use SVG; Vega's optional native canvas backend
    // is unavailable in the browser and Cloudflare runtime.
    config.resolve.alias.canvas = false
    return config
  }
  // www -> apex redirect lives in middleware.ts. We tried Next's redirects()
  // here first, but OpenNext Cloudflare currently does not substitute
  // `:path*` tokens in destination URLs, so requests landed on the literal
  // /:path* path and 404'd. Middleware uses NextResponse.redirect and avoids
  // the templating layer entirely.
}

initOpenNextCloudflareForDev()

export default config
