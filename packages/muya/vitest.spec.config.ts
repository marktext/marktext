// Dedicated vitest config for the CommonMark / GFM spec conformance suites.
//
// Why a separate config rather than vitest projects?
//   Vitest's `test.projects` feature did not cooperate with our existing
//   `lib`/`dts` plugin chain in vite.config.ts (paths got mis-rooted at
//   `packages/core/packages/core/test/...`). A second config file is simpler:
//   each entrypoint owns its `include` glob and there's no project filter to
//   pass.
//
// Used by:
//   pnpm --filter @muyajs/core test:spec               (runs both spec files)
//   pnpm --filter @muyajs/core test:spec:commonmark    (runs only CommonMark)
//   pnpm --filter @muyajs/core test:spec:gfm           (runs only GFM)

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['test/spec/**/*.{spec,test}.ts'],
        environment: 'happy-dom',
        // The spec suites use it.each(670+) — keep a generous timeout so CI
        // tail latency on slow Windows runners doesn't false-positive.
        testTimeout: 30000,
    },
});
