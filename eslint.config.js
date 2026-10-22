import eslintJs from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginHtml from 'eslint-plugin-html'
import pluginI18nJson from 'eslint-plugin-i18n-json'
import pluginJsonc from 'eslint-plugin-jsonc'
import neostandard, { plugins as neostandardPlugins } from 'neostandard'
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
      '**/out/**',
      '**/dist/**',
      // The website ships with its own ESLint v8 config (React conventions).
      // The root config here is desktop-focused; mixing the two surfaces
      // pre-existing website style errors into desktop CI.
      'packages/website/**',
      // muya v2 (TS) self-lints with its own antfu-based config
      // (packages/muya/eslint.config.mjs). Different style rules from the
      // marktext-desktop config (4-space indent, semis required, strict
      // ts/no-explicit-any), so we keep them isolated rather than try to
      // merge two flat configs.
      'packages/muya/**',
      'packages/desktop/src/renderer/src/assets/symbolIcon/index.js',
      '**/*.min.json',
      // Playwright writes these next to its config (packages/desktop/), not at
      // the repo root, so they need the `**/` prefix to be ignored at all.
      '**/test-results/**',
      '**/playwright-report/**'
    ]
  },

  // 1. ESLint core recommended
  js.recommended,
  ...neostandard(),

  // 2. typescript-eslint recommended — scoped to TS files only. `.vue` cannot
  // join this scope: it needs `vue-eslint-parser` as the top-level parser, so
  // section 5 sets that up and opts in to the rules it wants.
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts']
  })),

  // 3. TS/TSX files: typescript-eslint parser
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'],
    // neostandard scopes its `@stylistic` registration to JS files, so the
    // `@stylistic/*` overrides below need the plugin declared for TS here.
    plugins: { '@stylistic': neostandardPlugins['@stylistic'] },
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
      // Defer to @stylistic/no-extra-semi (set by neostandard) — it knows
      // about leading-semi standard-style guards; the deprecated core rule
      // does not.
      'no-extra-semi': 'off',
      '@stylistic/indent': ['error', 2, { SwitchCase: 1, ignoreComments: true }],
      '@stylistic/semi': ['error', 'never'],
      // @stylistic 5 added a `catch` category; the string form now also
      // forbids `catch (e)`, which is the style used throughout this repo.
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'never', named: 'never', asyncArrow: 'never', catch: 'always' }
      ],
      '@stylistic/arrow-parens': 'off',
      '@stylistic/no-mixed-operators': 'off'
    }
  },

  // 4. Vue plugin baseline
  ...pluginVue.configs['flat/recommended'],

  // 5. Vue files: vue-eslint-parser with delegated TS sub-parser for <script lang="ts">
  // The plugin has to be registered here too: flat config only exposes a
  // plugin's rules to files matched by the config object that declares it, and
  // section 2 is scoped to `.ts`.
  {
    files: ['**/*.vue'],
    plugins: { '@typescript-eslint': tseslint.plugin },
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
      '@typescript-eslint/no-explicit-any': 'error',
      // `<script setup lang="ts">` needs the TS-aware rule: core `no-unused-vars`
      // misreads type members (props/emit signatures) as unused bindings.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off'
    }
  },

  // 6. JS files: keep the Babel parser for the few hand-written `.js` files
  // left in the source tree. Narrow the scope so stray .js files in the
  // migrated directories can't slip past the TS lint rules.
  {
    files: [
      'packages/desktop/src/renderer/src/assets/symbolIcon/**/*.js',
      'eslint.config.js'
    ],
    plugins: {
      html: pluginHtml,
      '@stylistic': neostandardPlugins['@stylistic']
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
      '@stylistic/space-before-function-paren': [
        'error',
        { anonymous: 'never', named: 'never', asyncArrow: 'never', catch: 'always' }
      ],
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
    ignores: ['node_modules']
  },

  // 7. Test files: add Vitest globals (covers both .js and .ts specs)
  {
    files: ['packages/desktop/test/**/*.js', 'packages/desktop/test/**/*.ts'],
    languageOptions: {
      globals: { ...globals.vitest }
    }
  },

  // 8. JSON validation
  ...pluginJsonc.configs['flat/recommended-with-json'],

  // 9. i18n JSON locales
  {
    files: ['packages/desktop/src/shared/i18n/locales/*.json'],
    plugins: {
      'i18n-json': pluginI18nJson
    },
    rules: {
      'i18n-json/valid-json': 'error',
      'i18n-json/sorted-keys': 'warn',
      'i18n-json/identical-keys': [
        'error',
        {
          filePath: 'packages/desktop/src/shared/i18n/locales/en.json'
        }
      ]
    }
  }
]
