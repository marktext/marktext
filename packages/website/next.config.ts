import type { NextConfig } from 'next'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { initOpenNextCloudflareForDev } from '@opennextjs/cloudflare'

const __dirname = dirname(fileURLToPath(import.meta.url))

const config: NextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  transpilePackages: ['mermaid'],
  outputFileTracingRoot: resolve(__dirname, '../..'),
  images: {
    unoptimized: true
  },
  experimental: {
    optimizePackageImports: ['katex']
  },
  // marktext.me is canonical; redirect www -> apex permanently so SEO doesn't
  // index duplicate hostnames. Both are bound as Worker Custom Domains in
  // wrangler.toml, so the Worker handles www requests before issuing the 301.
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.marktext.me' }],
        destination: 'https://marktext.me/:path*',
        permanent: true
      }
    ]
  }
}

initOpenNextCloudflareForDev()

export default config
