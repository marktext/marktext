// @vitest-environment happy-dom
/* eslint-disable test/prefer-lowercase-title */

import type { StrongEmToken, Token } from '../types';
// @ts-expect-error commonmark-spec is plain CommonJS w/o types
import cms from 'commonmark-spec';

import { describe, expect, it } from 'vitest';
import { escapeHTML } from '../../utils';
import { scanEmphasisSpans } from '../emphasis';
import { tokenizer } from '../lexer';
import { inlineRules } from '../rules';

const EXPECTED_FAILURES = new Map<number, string>([
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

function renderTokens(tokens: Token[]): string {
    let html = '';

    for (const token of tokens) {
        switch (token.type) {
            case 'text':
                html += escapeHTML(token.content);
                break;

            case 'em':
            case 'strong':
            case 'del':
                html += `<${token.type}>${renderTokens(token.children)}</${token.type}>`;
                break;

            case 'inline_code':
                html += `<code>${escapeHTML(token.content)}</code>`;
                break;

            case 'link': {
                const title = token.title ? ` title="${escapeHTML(token.title)}"` : '';
                html += `<a href="${escapeHTML(token.href)}"${title}>${renderTokens(token.children)}</a>`;
                break;
            }

            case 'auto_link':
                html += `<a href="${escapeHTML(token.href)}">${escapeHTML(token.raw.replace(/^<|>$/g, ''))}</a>`;
                break;

            case 'backlash':
                html += escapeHTML(token.raw.replace(/^\\/, ''));
                break;

            case 'soft_line_break':
                html += '\n';
                break;

            default:
                html += token.raw;
                break;
        }
    }

    return html;
}

function renderInline(markdown: string, labels = new Map()) {
    return renderTokens(
        tokenizer(markdown.replace(/\n$/, ''), {
            hasBeginRules: false,
            labels,
            options: OPTIONS,
        }),
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
    it('`*foo***bar*` keeps the leftover asterisk between the two pairs', () => {
        expect(renderInline('*foo***bar*')).toBe('<em>foo</em>*<em>bar</em>');
    });

    it('`**foo***bar**` closes the strong before opening the em', () => {
        expect(renderInline('**foo***bar**')).toBe('<strong>foo</strong><em>bar</em>*');
    });

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

            const found = [...scanEmphasisSpans(src, 0, inlineRules, new Map(), OPTIONS, true).values()]
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
    it.each([
        ['*a `x*y` b*', '<em>a <code>x*y</code> b</em>'],
        ['*a <http://x.com/y*z> b*', '<em>a <a href="http://x.com/y*z">http://x.com/y*z</a> b</em>'],
        ['*a [t](/u*v) b*', '<em>a <a href="/u*v">t</a> b</em>'],
        ['*foo [bar* baz]', '<em>foo [bar</em> baz]'],
        ['*[foo*](/uri)', '*<a href="/uri">foo*</a>'],
    ])('%s', (markdown, expected) => {
        expect(renderInline(markdown)).toBe(expected);
    });

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

    it('a code span overrunning a reference link keeps its delimiters visible', () => {
        expect(renderInline('*a [`x][ref]` b*', new Map([['ref', { href: '/uri', title: '' }]])))
            .toBe('<em>a [<code>x][ref]</code> b</em>');
    });

    it.each([
        ['*www.x.com/a*b*c*', '<em>www.x.com/a*b*c</em>'],
        ['~~www.x.com/a*b*c~~', '<del>www.x.com/a<em>b</em>c</del>'],
    ])('%s', (markdown, expected) => {
        expect(renderInline(markdown)).toBe(expected);
    });
});

describe('one scan for the whole tree', () => {
    it('does not re-decide a nested run out of context', () => {
        expect(renderInline('*_b.__*')).toBe('<em>_b.__</em>');
    });
});
