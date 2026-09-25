// @vitest-environment happy-dom
/* eslint-disable test/prefer-lowercase-title */
// The per-example titles carry CommonMark's own section heading and example
// numbers so failures line up with the upstream spec.

import type { StrongEmToken, Token } from '../types';
// @ts-expect-error commonmark-spec is plain CommonJS w/o types
import cms from 'commonmark-spec';

import { describe, expect, it } from 'vitest';
import escapeCharactersMap from '../../config/escapeCharacter';
import { tokenizer } from '../lexer';

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
