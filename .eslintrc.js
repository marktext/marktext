module.exports = {
  root: true,
  parserOptions: {
    parser: '@babel/eslint-parser',
    ecmaVersion: 2022, // Update to ES2022
    ecmaFeatures: {
      impliedStrict: true
    },
    sourceType: 'module'
  },
  env: {
    browser: true,
    es2022: true, // Align with ES2022
    node: true
  },
  extends: [
    'eslint:recommended',
    'plugin:vue/vue3-recommended', // Updated for Vue 3
    'plugin:import/errors',
    'plugin:import/warnings',
    'standard'
  ],
  globals: {
    __static: true
  },
  plugins: ['vue', 'import'],
  rules: {
    // Two spaces but disallow semicolons
    indent: ['error', 2, { SwitchCase: 1, ignoreComments: true }],
    semi: ['error', 'never'],
    'no-return-await': 'error',
    'no-return-assign': 'error',
    'no-new': 'error',
    'arrow-parens': ['error', 'always'], // Stricter enforcement for consistency
    'no-console': 'warn', // Warnings instead of allowing it outright
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'prefer-const': 'error', // Enforce best practices
    'no-mixed-operators': 'warn',
    'no-prototype-builtins': 'warn'
  },
  settings: {
    'import/resolver': {
      alias: {
        map: [
          ['common', './src/common'],
          ['@', './src/renderer'],
          ['muya', './src/muya']
        ],
        extensions: ['.js', '.vue', '.json', '.css', '.node']
      }
    }
  },
  ignorePatterns: [
    'node_modules',
    'src/muya/dist/**/*',
    'src/muya/webpack.config.js'
  ]
}
