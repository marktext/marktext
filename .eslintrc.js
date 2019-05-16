module.exports = {
  root: true,
  parserOptions: {
    parser: 'babel-eslint',
    ecmaVersion: 8,
    ecmaFeatures: {
      impliedStrict: true
    },
    sourceType: 'module'
  },
  env: {
    browser: true,
    es6: true,
    node: true
  },
  extends: [
    'standard',
    'eslint:recommended',
    'plugin:vue/base',
    'plugin:import/errors',
    'plugin:import/warnings'
  ],
  globals: {
    __static: true
  },
  plugins: [
    'html',
    'vue'
  ],
  rules: {
    // allow paren-less arrow functions
    'arrow-parens': 0,
    // allow async-await
    'generator-star-spacing': 0,
    // allow console
    'no-console': 0,
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
    // disallow semicolons
    semi: [2, "never"]
  },
  settings: {
    'import/resolver': {
      alias: {
        map: [
          ['common', './src/common'],
          // Normally only valid for renderer/
          ['@', './src/renderer'],
          ['muya', './src/muya']
        ],
        extensions: ['.js', '.vue', '.json', '.css', '.node']
      }
    }
  }
}
