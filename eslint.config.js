import eslintJs from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginHtml from 'eslint-plugin-html'
import pluginI18nJson from 'eslint-plugin-i18n-json'
import pluginJsonc from 'eslint-plugin-jsonc'
import neostandard from 'neostandard'
import babelParser from '@babel/eslint-parser'
import globals from 'globals'
const { configs: js } = eslintJs

export default [
  // 0. Global ignores (must be first)
  {
    ignores: [
      'out/**',
      'src/muya/lib/assets/libs/**',
      'src/muya/lib/parser/marked/urlify.js',
      'src/renderer/src/assets/symbolIcon/index.js',
    ]
  },

  // 1. ESLint core recommended rules

  js.recommended,
  // 1. Use neostandard instead
  ...neostandard(),

  ...pluginVue.configs['flat/recommended'],

  // 3. Custom overrides for JS files
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    plugins: {
      html: pluginHtml
    },
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        ecmaVersion: 'latest',
        sourceType: 'module'
      },
      globals: {
        ...globals.browser,
        MARKTEXT_VERSION_STRING: 'readonly',
        MARKTEXT_VERSION: 'readonly',
        __static: 'readonly'
      }
    },
    rules: {
      '@stylistic/indent': ['error', 2, { SwitchCase: 1, ignoreComments: true }],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/space-before-function-paren': ['error', 'never'],
      '@stylistic/arrow-parens': 'off',
      '@stylistic/no-mixed-operators': 'off',
      'no-return-await': 'error',
      'no-return-assign': 'error',
      'no-new': 'error',
      'no-console': 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
      'require-atomic-updates': 'off',
      'prefer-const': 'off',
      'no-prototype-builtins': 'off',
    },
    ignores: ['node_modules', 'src/muya/dist/**/*', 'src/muya/webpack.config.js']
  },

  // 3b. Vue files: add browser globals and relax conventions
  {
    files: ['**/*.vue'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
    }
  },

  // 3c. Test file globals
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: { ...globals.vitest }
    }
  },

  // 3d. Relax behavioral rules for legacy muya editor engine
  {
    files: ['src/muya/lib/**/*.js'],
    rules: {
      'no-sequences': 'off',
      'no-unused-expressions': 'off',
      'no-return-assign': 'off',
      eqeqeq: 'warn',
      'no-var': 'warn',
    }
  },

  // 4. JSON files basic validation
  ...pluginJsonc.configs['flat/recommended-with-json'],

  // 5. i18n JSON files validation
  {
    files: ['src/shared/i18n/locales/*.json'],
    plugins: {
      'i18n-json': pluginI18nJson
    },
    rules: {
      'i18n-json/valid-json': 'error',
      'i18n-json/sorted-keys': 'warn',
      'i18n-json/identical-keys': [
        'error',
        {
          filePath: 'src/shared/i18n/locales/en.json'
        }
      ]
    }
  }
]
