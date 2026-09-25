// @vitest-environment happy-dom
/* eslint-disable test/prefer-lowercase-title */
// The per-example titles carry CommonMark's own section heading and example
// numbers so failures line up with the upstream spec.

import type { StrongEmToken, Token } from '../types';
// @ts-expect-error commonmark-spec is plain CommonJS w/o types
import cms from 'commonmark-spec';

import { describe, expect, it } from 'vitest';
import escapeCharactersMap from '../../config/escapeCharacter';
import { scanEmphasisSpans } from '../emphasis';
import { tokenizer } from '../lexer';
import { inlineRules } from '../rules';

// The live editor tokenizes inline markdown with muya's own lexer, NOT with
// the marked-based static/export path that `test/spec/` measures. Emphasis is
// where the two used to disagree the most: the lexer paired every `*` / `_`
// run with the first plausible partner to its right, so `*a *b* c*` came out
// as `<em>a *b</em> c*` instead of the nested pair CommonMark asks for
// (marktext#2086). `inlineRenderer/emphasis.ts` now runs the spec's delimiter
// algorithm, and this suite holds that line by replaying the whole
// "Emphasis and strong emphasis" section through the lexer.

// Examples the lexer still gets wrong, with the reason. Same contract as
// `test/spec/expected-failures.json`: an example listed here that starts
// passing fails the suite, so compliance can only go up.
const EXPECTED_FAILURES = new Map<number, string>([
    // CommonMark 0.30 widened "Unicode punctuation" to the S (symbol)
    // categories; PUNCTUATION_REG still carries the 0.29 list, so `£` and `€`
    // are not flanking boundaries and `*£*bravo.` italicises. Unrelated to
    // delimiter pairing — `*$*alpha.`, the ASCII third of this example, passes.
    [354, 'PUNCTUATION_REG predates CommonMark 0.30 Unicode-symbol punctuation'],
]);

const OPTIONS = {
    superSubScript: false,
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
};

function escapeHtml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Render the token tree the way a reader sees it — markers dropped — so the
// lexer's output can be compared against the spec's reference HTML. Only the
// token kinds the emphasis section produces need a case; anything else falls
// through to its raw source, which is what the spec expects of a construct
// the lexer left alone.
function renderTokens(tokens: Token[]): string {
    let html = '';

    for (const token of tokens) {
        switch (token.type) {
            case 'text':
                html += escapeHtml(token.content);
                break;

            case 'em':
            case 'strong':
            case 'del':
                html += `<${token.type}>${renderTokens(token.children)}</${token.type}>`;
                break;

            case 'inline_code':
                html += `<code>${escapeHtml(token.content)}</code>`;
                break;

            case 'link': {
                const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
                html += `<a href="${escapeHtml(token.href)}"${title}>${renderTokens(token.children)}</a>`;
                break;
            }

            case 'image': {
                const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
                html += `<img src="${escapeHtml(token.src)}" alt="${escapeHtml(token.alt)}"${title} />`;
                break;
            }

            case 'auto_link':
                html += `<a href="${escapeHtml(token.href)}">${escapeHtml(token.raw.replace(/^<|>$/g, ''))}</a>`;
                break;

            case 'backlash':
                html += escapeHtml(token.raw.replace(/^\\/, ''));
                break;

            case 'html_escape':
                html += escapeHtml(escapeCharactersMap[token.escapeCharacter] ?? token.raw);
                break;

            case 'soft_line_break':
                html += '\n';
                break;

            case 'hard_line_break':
                html += '<br />\n';
                break;

            default:
                html += token.raw;
                break;
        }
    }

    return html;
}

function renderInline(markdown: string) {
    return renderTokens(
        tokenizer(markdown.replace(/\n$/, ''), { hasBeginRules: false, options: OPTIONS }),
    );
}

interface ISpecExample {
    markdown: string;
    html: string;
    section: string;
    number: number;
}

const examples: ISpecExample[] = (cms.tests as ISpecExample[]).filter(
    example => example.section === 'Emphasis and strong emphasis',
);

describe('inline lexer — CommonMark 0.31 emphasis and strong emphasis', () => {
    it('the spec section is actually loaded', () => {
        expect(examples.length).toBeGreaterThan(100);
    });

    it.each(examples)('CM 0.31 §$section #$number', (example) => {
        // The spec wraps every one of these in a single paragraph; the inline
        // lexer is handed that paragraph's content, so unwrap it.
        const expected = example.html.replace(/^<p>/, '').replace(/<\/p>\n$/, '');
        const actual = renderInline(example.markdown);
        const knownGap = EXPECTED_FAILURES.get(example.number);

        if (knownGap) {
            expect(
                actual,
                `#${example.number} now passes — drop it from EXPECTED_FAILURES (${knownGap})`,
            ).not.toBe(expected);
            return;
        }

        expect(actual, JSON.stringify(example.markdown)).toBe(expected);
    });
});

describe('nested emphasis delimiters (#2086)', () => {
    // The two lines from the issue report. A closer binds to the *nearest*
    // opener still on the stack, so the middle `*` — which can only open,
    // being preceded by a space — takes the third one as its partner and the
    // outer pair spans the whole line.
    it('`*a *b* c*` nests one em inside another', () => {
        expect(renderInline('*a *b* c*')).toBe('<em>a <em>b</em> c</em>');
    });

    it('`**a **b** c**` nests one strong inside another', () => {
        expect(renderInline('**a **b** c**')).toBe(
            '<strong>a <strong>b</strong> c</strong>',
        );
    });

    it('`_a _b_ c_` nests with underscores too', () => {
        expect(renderInline('_a _b_ c_')).toBe('<em>a <em>b</em> c</em>');
    });

    // The outer em's token must still describe its own source exactly — the
    // renderer draws the markers from `marker` and `range`, and `format()`
    // rebuilds the span from `children`.
    it('the outer token spans the whole run', () => {
        const [token] = tokenizer('*a *b* c*', { hasBeginRules: false });

        expect(token.type).toBe('em');
        expect(token.raw).toBe('*a *b* c*');
        expect(token.range).toEqual({ start: 0, end: 9 });
        expect((token as StrongEmToken).marker).toBe('*');
        expect((token as StrongEmToken).children.map(child => child.raw)).toEqual([
            'a ',
            '*b*',
            ' c',
        ]);
    });
});

describe('delimiter runs spent from both ends', () => {
    // A run that closes one pair and then opens the next spends characters
    // from opposite ends. Tracking a single "how many are left" counter hands
    // the same character to both pairings, which at best shifts a marker and
    // at worst emits overlapping spans and drops a whole token.
    it('`*foo***bar*` keeps the leftover asterisk between the two pairs', () => {
        expect(renderInline('*foo***bar*')).toBe('<em>foo</em>*<em>bar</em>');
    });

    it('`**foo***bar**` closes the strong before opening the em', () => {
        expect(renderInline('**foo***bar**')).toBe('<strong>foo</strong><em>bar</em>*');
    });

    // Randomised guard for the invariant the spec examples do not pin down: no
    // two spans may partially overlap, and a span's two markers must be the
    // same characters. Fixed seed, so a failure is reproducible.
    it('never emits overlapping or malformed spans', () => {
        const alphabet = [...'*_~`ab. []()!<>\\$:'];
        let seed = 42;
        const random = () => {
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
            return seed / 0x7FFFFFFF;
        };
        const broken: string[] = [];

        for (let n = 0; n < 5000; n++) {
            let src = '';
            for (let i = 1 + Math.floor(random() * 14); i > 0; i--)
                src += alphabet[Math.floor(random() * alphabet.length)];

            const found = [...scanEmphasisSpans(src, 0, inlineRules, new Map(), OPTIONS).values()]
                .sort((a, b) => a.start - b.start || b.end - a.end);

            for (const [i, span] of found.entries()) {
                const opener = src.slice(span.start, span.start + span.markerLen);
                if (
                    span.start < 0
                    || span.end > src.length
                    || span.end - span.start < 2 * span.markerLen
                    || opener !== src.slice(span.end - span.markerLen, span.end)
                ) {
                    broken.push(`${JSON.stringify(src)} — malformed [${span.start},${span.end})`);
                }

                for (const other of found.slice(i + 1)) {
                    const disjoint = other.start >= span.end;
                    const nested
                        = other.start >= span.start + span.markerLen
                            && other.end <= span.end - span.markerLen;
                    if (!disjoint && !nested) {
                        broken.push(
                            `${JSON.stringify(src)} — [${span.start},${span.end}) vs [${other.start},${other.end})`,
                        );
                    }
                }
            }
        }

        expect(broken).toEqual([]);
    });
});

describe('constructs that outrank emphasis', () => {
    // The scan walks over these, so a delimiter inside one is never collected.
    it.each([
        ['*a `x*y` b*', '<em>a <code>x*y</code> b</em>'],
        ['*a <http://x.com/y*z> b*', '<em>a <a href="http://x.com/y*z">http://x.com/y*z</a> b</em>'],
        ['*a [t](/u*v) b*', '<em>a <a href="/u*v">t</a> b</em>'],
        ['*foo [bar* baz]', '<em>foo [bar</em> baz]'],
        ['*[foo*](/uri)', '*<a href="/uri">foo*</a>'],
    ])('%s', (markdown, expected) => {
        expect(renderInline(markdown)).toBe(expected);
    });

    // `backlash` matches `\(`, so trying it before the math rules would eat
    // the formula's own opener and leave the `*` inside it as a delimiter.
    it('backslash-delimited math shields its delimiters', () => {
        const tokens = tokenizer('*a \\(x*y\\) b*', {
            hasBeginRules: false,
            options: { ...OPTIONS, texMathSingleBackslash: true },
        });

        expect(tokens.map(token => token.type)).toEqual(['em']);
        expect((tokens[0] as StrongEmToken).children.map(child => child.type)).toEqual([
            'text',
            'inline_math',
            'text',
        ]);
    });

    // A reference outranks emphasis only once its label resolves; without a
    // definition the brackets are literal text and the delimiters are real.
    it.each([
        ['resolved', new Map([['ref', { href: '/uri', title: '' }]]), ['text', 'reference_link']],
        ['undefined', new Map(), ['em', 'text']],
    ])('reference link — %s', (_name, labels, expected) => {
        const tokens = tokenizer('*[foo*][ref]', {
            hasBeginRules: false,
            labels: labels as never,
            options: OPTIONS,
        });

        expect(tokens.map(token => token.type)).toEqual(expected);
    });
});

describe('one scan for the whole tree', () => {
    // Re-scanning a span's content on its own judges the content's outermost
    // runs against the string boundary instead of the markers now wrapped
    // around them, and can pair runs the enclosing scan deliberately left
    // alone — here `__` is left-flanking only because the outer `*` follows it.
    it('does not re-decide a nested run out of context', () => {
        expect(renderInline('*_b.__*')).toBe('<em>_b.__</em>');
    });
});
