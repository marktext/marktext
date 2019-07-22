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
    'arrow-parens': "off",
    // allow async-await
    'generator-star-spacing': "off",
    // allow console
    'no-console': "off",
    // allow debugger during development
    'no-debugger': process.env.NODE_ENV === 'production' ? "error" : "off",
    'no-return-assign': "warn",
    'no-new': "warn",
    // disallow semicolons
    semi: [2, "never"],
    'require-atomic-updates': "off",
    // TODO: fix these errors someday
    'prefer-const': "off",
    'no-new': "off",
    'no-mixed-operators': "off",
    'no-prototype-builtins': "off",
    "no-return-await": "off"
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
