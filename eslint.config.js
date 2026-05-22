import eslintJs from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginHtml from 'eslint-plugin-html'
import pluginI18nJson from 'eslint-plugin-i18n-json'
import pluginJsonc from 'eslint-plugin-jsonc'
import neostandard from 'neostandard'
import babelParser from '@babel/eslint-parser'
import tseslint from 'typescript-eslint'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'
const { configs: js } = eslintJs

export default [
  // 0. Global ignores (must be first)
  {
    ignores: [
      '.claude/**',
      'out/**',
      'dist/**',
      'src/muya/lib/assets/libs/**',
      'src/muya/lib/parser/marked/urlify.js',
      'src/renderer/src/assets/symbolIcon/index.js',
      '**/*.min.json',
      'test-results/**',
      'playwright-report/**'
    ]
  },

  // 1. ESLint core recommended
  js.recommended,
  ...neostandard(),

  // 2. typescript-eslint recommended — scoped to TS files only.
  // .vue files are added to this scope in Commit 8 (when they convert to
  // lang="ts"). Until then they're treated as JS by section 5.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']
  })),

  // 3. TS/TSX files: typescript-eslint parser
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
        // `project: ...` (type-aware linting) intentionally omitted — too slow
        // for ~200-file lint on every PR. Add a separate `lint:types` script
        // later if we want type-aware rules.
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        MARKTEXT_VERSION_STRING: 'readonly',
        MARKTEXT_VERSION: 'readonly',
        __static: 'readonly'
      }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' }
      ],
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Disable JS-only rules that double-trigger or fight TS:
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-redeclare': 'off',
      '@stylistic/indent': ['error', 2, { SwitchCase: 1, ignoreComments: true }],
      '@stylistic/semi': ['error', 'never'],
      '@stylistic/space-before-function-paren': ['error', 'never'],
      '@stylistic/arrow-parens': 'off',
      '@stylistic/no-mixed-operators': 'off'
    }
  },

  // 4. Vue plugin baseline
  ...pluginVue.configs['flat/recommended'],

  // 5. Vue files: vue-eslint-parser with delegated TS sub-parser for <script lang="ts">
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: {
          ts: tseslint.parser,
          tsx: tseslint.parser,
          js: babelParser,
          jsx: babelParser
        },
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
        requireConfigFile: false
      },
      globals: { ...globals.browser }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off'
    }
  },

  // 6. JS/MJS/CJS files: keep Babel parser. After Commit 11 (allowJs:false),
  // the only remaining JS in the source tree is src/muya/ (kept JS pending
  // upstream TS muya replacement) + a couple of assets/symbolIcon files.
  // Narrow the JS-file scope to prevent stray .js files in the migrated
  // directories from slipping past the TS lint rules.
  {
    files: [
      'src/muya/**/*.js',
      'src/muya/**/*.mjs',
      'src/muya/**/*.cjs',
      'src/renderer/src/assets/symbolIcon/**/*.js',
      'eslint.config.js'
    ],
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
        ...globals.node,
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
      'no-prototype-builtins': 'off'
    },
    ignores: ['node_modules', 'src/muya/dist/**/*', 'src/muya/webpack.config.js']
  },

  // 7. Test files: add Vitest globals (covers both .js and .ts specs)
  {
    files: ['test/**/*.js', 'test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.vitest }
    }
  },

  // 8. Relax behavioral rules for the legacy muya editor engine (JS only — muya stays JS)
  {
    files: ['src/muya/lib/**/*.js'],
    rules: {
      'no-sequences': 'off',
      'no-unused-expressions': 'off',
      'no-return-assign': 'off',
      eqeqeq: 'warn',
      'no-var': 'warn'
    }
  },

  // 9. JSON validation
  ...pluginJsonc.configs['flat/recommended-with-json'],

  // 10. i18n JSON locales
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
