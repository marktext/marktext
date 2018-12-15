module.exports = {
  root: true,
  parser: 'babel-eslint',
  parserOptions: {
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
    'plugin:vue/base' // 'plugin:vue/essential'
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
    'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0
  }
}
