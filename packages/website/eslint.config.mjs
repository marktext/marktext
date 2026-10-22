// eslint-config-next ships a flat config as of Next 16, so it is spread
// directly instead of being bridged through @eslint/eslintrc's FlatCompat.
import nextConfig from 'eslint-config-next/core-web-vitals'

const config = [
  {
    ignores: [
      '.next/**',
      '.open-next/**',
      '.wrangler/**',
      'out/**',
      'node_modules/**'
    ]
  },
  ...nextConfig,
  {
    rules: {
      '@next/next/no-img-element': 'off',
      // These components hydrate browser-only state (localStorage, navigator)
      // after mount. Reading it in a `useState` initializer instead would make
      // the server and client render different markup, so the effect is the
      // hydration-safe shape and the rule's cascading-render warning is noise.
      'react-hooks/set-state-in-effect': 'off'
    }
  }
]

export default config
