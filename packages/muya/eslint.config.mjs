// eslint.config.mjs
import antfu from '@antfu/eslint-config';
import parser from '@typescript-eslint/parser';

function typescriptPreset() {
    const memberSelectors = ['classProperty', 'classMethod', 'parameterProperty', 'classicAccessor', 'autoAccessor'];

    return {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
            // Ban `any` (annotations, casts, generics). Genuine escape
            // hatches (the block-constructor registry's `state: any`, the
            // event Listener's `(...args: any[])`) are explicit
            // `eslint-disable-next-line ts/no-explicit-any` comments at
            // the source so they remain visible and reviewable.
            'ts/no-explicit-any': 'error',
            // Ban the `value as unknown as X` double-cast escape hatch outside
            // a small set of audited boundary helpers (json1 ↔ TState, the
            // dynamic inline-renderer dispatch table, marked hook this-binding,
            // structural punning where two token unions overlap at runtime).
            // New `as unknown as X` must come with a `// eslint-disable-next-line`
            // and a comment explaining why the boundary can't be expressed in
            // the TS type system.
            'no-restricted-syntax': [
                'error',
                {
                    selector: 'TSAsExpression > TSAsExpression[typeAnnotation.type=\'TSUnknownKeyword\']',
                    message: '`value as unknown as X` double-casts the type system. Use a type guard, narrow via `instanceof` / discriminator, or wrap the unsafe boundary in a named helper. If genuinely unavoidable, disable this rule with an explanatory comment.',
                },
            ],
            'ts/naming-convention': [
                'error',
                // Interfaces' names should start with a capital 'I'.
                {
                    selector: 'interface',
                    format: ['PascalCase'],
                    custom: {
                        regex: '^I[A-Z0-9]',
                        match: true,
                    },
                },
                // `_` <=> private: this block forbids a leading `_` on every member;
                // the private block below (more specific, so it wins regardless of
                // order) requires it. `format: null` checks only the underscore.
                {
                    selector: memberSelectors,
                    format: null,
                    leadingUnderscore: 'forbid',
                },
                {
                    selector: memberSelectors,
                    modifiers: ['private'],
                    format: ['camelCase'],
                    leadingUnderscore: 'require',
                },
            ],
        },
        languageOptions: {
            parser,
        },
    };
}

// Test files routinely build partial structural mocks for the block-tree
// classes (`fake as unknown as Table`); policing the double-cast pattern
// there adds noise without safety. Disable only `no-restricted-syntax` —
// `ts/no-explicit-any` and `ts/naming-convention` stay on for tests.
//
// The parity-scoreboard specs name every test after its gap id
// (`PG3: …`) so fix PRs can grep + flip the `it.fails` marker. Allow that
// uppercase `PG` prefix through `prefer-lowercase-title`; all other test
// titles still have to start lowercase.
function testFileDoubleCastOverride() {
    return {
        files: [
            '**/*.spec.ts',
            '**/*.spec.tsx',
            '**/*.test.ts',
            '**/*.test.tsx',
        ],
        rules: {
            'no-restricted-syntax': 'off',
            'test/prefer-lowercase-title': ['error', { allowedPrefixes: ['PG'] }],
        },
    };
}

export default antfu(
    {
        stylistic: {
            indent: 4,
            semi: true,
        },
        react: false,
        yaml: {
            overrides: {
                'yaml/indent': ['error', 4, { indicatorValueIndent: 2 }],
            },
        },
        markdown: false,
        typescript: true,
        formatters: {
            css: true,
            html: true,
        },
        // CommonMark / GFM spec fixtures are generated from upstream sources
        // (commonmark/CommonMark spec.txt + github/cmark-gfm spec.txt); lint
        // rules around indent / line length don't apply to data files.
        ignores: [
            'test/spec/fixtures/**',
            'test/spec/expected-failures.json',
            'test/spec/conformance.md',
            'examples/**',
            'e2e/**',
            'lib/**',
            'docs/**',
            // Vendored third-party library (js-sequence-diagrams, bramp, BSD)
            // wired to snap.svg. Kept verbatim for feature parity with the
            // legacy muyajs engine; not subject to our lint/format rules.
            'src/utils/diagram/sequence/sequence-diagram-snap.js',
            'src/utils/diagram/sequence/sequence-diagram.css',
        ],
    },
    {
        files: ['**/*.ts', '**/*.tsx'],
        ignores: [
            '**/*.tsx',
            '**/*.d.ts',
            '**/vite.config.ts',
            'playwright.config.ts',
            '**/*.spec.ts',
            '**/*.spec.tsx',
            '**/*.test.ts',
            '**/*.test.tsx',
        ], // do not check test files
        rules: {
            'complexity': ['warn', { max: 20 }],
            'max-lines-per-function': ['warn', 200],
        },
    },
    typescriptPreset(),
    testFileDoubleCastOverride(),
);
