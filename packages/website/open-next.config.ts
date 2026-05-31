import { defineCloudflareConfig } from '@opennextjs/cloudflare'
import staticAssetsIncrementalCache from '@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache'

// Every route in this app is statically prerendered (`dynamic = 'force-static'`),
// so we serve the cached HTML directly from Workers static assets. The default
// "dummy" incremental cache would 404 dynamic SSG routes like /docs/[...slug]
// because the worker has no place to look up their prerendered HTML at runtime.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache
})
