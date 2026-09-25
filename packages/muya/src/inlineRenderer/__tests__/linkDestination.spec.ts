// @vitest-environment happy-dom
/* eslint-disable test/prefer-lowercase-title */
// The per-example titles carry CommonMark's own section heading and example
// numbers so failures line up with the upstream spec.

import type { ImageToken, LinkToken, Token } from '../types';
// @ts-expect-error commonmark-spec is plain CommonJS w/o types
import cms from 'commonmark-spec';
import { describe, expect, it } from 'vitest';
import escapeCharactersMap from '../../config/escapeCharacter';
import { tokenizer } from '../lexer';

// The live editor tokenizes inline markdown with muya's own lexer, not with
// the marked-based static/export path that `test/spec/` measures. The two
// disagreed about every link whose destination was not a bare word: the lexer
// took everything between `](` and `)` as the destination, so `[link](/my uri)`
// became a link (CommonMark says it is literal text) while `[link](</my uri>)`
// kept its pointy brackets in the href and pointed nowhere (marktext#2377).
// `parseSrcAndTitle` now implements CommonMark's destination/title grammar,
// and this suite holds that line by replaying the spec's own link and image
// examples through the lexer.

const OPTIONS = {
    superSubScript: false,
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
};

// Examples the lexer still gets wrong, with the reason. Same contract as
// `test/spec/expected-failures.json`: an example listed here that starts
// passing fails the suite, so compliance can only go up. None of these are
// destination bugs — they are pre-existing gaps in neighbouring inline rules.
const EXPECTED_FAILURES = new Map<number, string>([
    [491, 'html_tag: the spec allows a tag to span a line ending, `html_tag` does not'],
    [493, 'html_tag: `<foo\\>` is not a valid tag, but `html_tag` accepts any `[^\\n<>]*` attribute run'],
    [494, 'html_tag: `<b)c>` is not a valid tag, but `html_tag` accepts any `[^\\n<>]*` attribute run'],
    [503, 'entity references in a destination are not decoded — the marked-based export path has the same gap'],
    [506, 'entity references in a title are not decoded — same gap as #503'],
    [510, 'no inline rule matches across a line ending, so a destination cannot span one'],
    [513, 'link text: the anchor group swallows an unmatched `]`'],
    [515, 'link text: a backslash-escaped `[` still opens the anchor group'],
    [518, 'link text: an inner link should veto the outer one (CommonMark §6.3 "links may not contain other links")'],
    [519, 'link text: same nesting veto as #518'],
    [520, 'link text: same nesting veto as #518, for an image label'],
    [523, 'emphasis and links bind in the wrong order — tracked separately in marktext#2086'],
    [574, 'image label: an inner image should still render its own alt text'],
    [575, 'image label: same as #574 for an inner link'],
]);

function escapeHtml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// The spec's reference HTML percent-encodes the destination on the way into
// the attribute; the token keeps the decoded form the editor's UI needs. This
// is `marked`'s own `cleanUrl`, so both render paths encode alike.
function cleanUrl(href: string) {
    try {
        return encodeURI(href).replace(/%25/g, '%');
    }
    catch {
        return href;
    }
}

// Render the token tree the way a reader sees it — markers dropped — so the
// lexer's output can be compared against the spec's reference HTML. Only the
// token kinds these two sections produce need a case; anything else falls
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
                html += `<a href="${escapeHtml(cleanUrl(token.href))}"${title}>${renderTokens(token.children)}</a>`;
                break;
            }

            case 'image': {
                const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
                html += `<img src="${escapeHtml(cleanUrl(token.src))}" alt="${escapeHtml(token.alt)}"${title} />`;
                break;
            }

            case 'auto_link':
                html += `<a href="${escapeHtml(cleanUrl(token.href))}">${escapeHtml(token.raw.replace(/^<|>$/g, ''))}</a>`;
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

function firstToken<TType extends Token['type']>(
    src: string,
    type: TType,
): Extract<Token, { type: TType }> | undefined {
    return tokenizer(src, { hasBeginRules: false }).find(t => t.type === type) as
        | Extract<Token, { type: TType }>
        | undefined;
}

interface ISpecExample {
    markdown: string;
    html: string;
    section: string;
    number: number;
}

// Inline links and images only: reference definitions live in their own block
// and reach the lexer through a `labels` map the InlineRenderer assembles from
// the whole document, and a blank line means the example spans several blocks.
// Neither shape survives being handed to the inline lexer as one string.
const examples = (cms.tests as ISpecExample[]).filter(
    example =>
        (example.section === 'Links' || example.section === 'Images')
        && !example.markdown.includes('\n\n')
        && !example.markdown.split('\n').some(line => /^ {0,3}\[[^\]]*\]:/.test(line)),
);

describe('inline lexer — CommonMark 0.31 inline links and images', () => {
    it('the spec sections are actually loaded', () => {
        expect(examples.length).toBeGreaterThan(40);
    });

    it.each(examples)('CM 0.31 §$section #$number', (example) => {
        const expected = example.html
            .replace(/^<p>/, '')
            .replace(/<\/p>\n$/, '')
            .replace(/\n$/, '');
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

// The parse decides where a link stops, and `correctUrl` rewrites the pattern's
// captured groups to match. Get that bookkeeping wrong by one character and the
// renderer draws a link's markers at the wrong offsets, which no single example
// is likely to catch — so assert the two invariants over a corpus instead:
// every token accounts for exactly the source it covers, and a link's token
// still spells out its own raw text.
describe('lexer invariants around the link tail', () => {
    // Fixed seed, so a failure is reproducible.
    function eachSample(check: (src: string, label: string) => void) {
        const alphabet = [...'[]()<>"\'\\ abc.*_`!#~$:/'];
        let seed = 20260925;
        const random = () => {
            seed = (seed * 1103515245 + 12345) & 0x7FFFFFFF;
            return seed / 0x7FFFFFFF;
        };

        for (let i = 0; i < 20000; i++) {
            const length = 4 + Math.floor(random() * 20);
            let src = '';
            for (let j = 0; j < length; j++)
                src += alphabet[Math.floor(random() * alphabet.length)];
            check(src, 'random');
        }

        // Every line of the spec, not just the link sections: a link's tail can
        // run into any other construct.
        for (const example of cms.tests as ISpecExample[]) {
            for (const line of example.markdown.split('\n'))
                check(line, `CM #${example.number}`);
        }
    }

    it('reassembles the input from the token raws', () => {
        const broken: string[] = [];

        eachSample((src, label) => {
            const joined = tokenizer(src, { hasBeginRules: false })
                .map(token => token.raw ?? '')
                .join('');
            if (joined !== src)
                broken.push(`${label} ${JSON.stringify(src)} -> ${JSON.stringify(joined)}`);
        });

        expect(broken.slice(0, 5)).toEqual([]);
    });

    it('keeps a link or image token spelling out its own raw text', () => {
        const broken: string[] = [];

        const walk = (tokens: Token[], src: string, label: string) => {
            for (const token of tokens) {
                if (token.type === 'link' || token.type === 'image') {
                    const anchor = token.type === 'link' ? token.anchor : token.alt;
                    const tail = token.type === 'link' ? token.hrefAndTitle : token.srcAndTitle;
                    const rebuilt = `${token.marker}${anchor}${token.backlash.first}](${tail}${token.backlash.second})`;
                    if (rebuilt !== token.raw)
                        broken.push(`${label} ${JSON.stringify(src)}: raw ${JSON.stringify(token.raw)} vs ${JSON.stringify(rebuilt)}`);
                    if (token.range.end - token.range.start !== token.raw.length)
                        broken.push(`${label} ${JSON.stringify(src)}: range ${token.range.start}..${token.range.end} over ${JSON.stringify(token.raw)}`);
                }
                if ('children' in token && Array.isArray(token.children))
                    walk(token.children, src, label);
            }
        };

        eachSample((src, label) => {
            walk(tokenizer(src, { hasBeginRules: false }), src, label);
        });

        expect(broken.slice(0, 5)).toEqual([]);
    });
});

describe('link destinations (#2377)', () => {
    // The two lines from the issue report.
    it('a bare destination may not contain spaces', () => {
        expect(firstToken('[link](/my uri)', 'link')).toBeUndefined();
        expect(renderInline('[link](/my uri)')).toBe('[link](/my uri)');
    });

    it('pointy brackets are what allow a space, and are not part of the href', () => {
        expect(firstToken('[link](</my uri>)', 'link')?.href).toBe('/my uri');
    });

    // What the issue's second report runs into: a Joplin export writes every
    // local path in pointy brackets, so every one of its links and images used
    // to arrive with `<`/`>` glued onto the target.
    it('strips pointy brackets from a destination that needs no escaping', () => {
        expect(firstToken('[link](<https://example.com/a>)', 'link')?.href).toBe(
            'https://example.com/a',
        );
        expect(firstToken('![pic](<./Nächste Termine.png>)', 'image')?.src).toBe(
            './Nächste Termine.png',
        );
    });

    it('images follow the same grammar as links', () => {
        expect(firstToken('![pic](/my image.png)', 'image')).toBeUndefined();
        expect(firstToken('![pic](</my image.png>)', 'image')?.src).toBe('/my image.png');
    });

    it('an empty pointy-bracket destination is an empty href', () => {
        expect(firstToken('[link](<>)', 'link')?.href).toBe('');
    });

    it('an unterminated pointy bracket is not a destination', () => {
        expect(firstToken('[link](<foo)', 'link')).toBeUndefined();
        expect(firstToken('[link](<foo\\>)', 'link')).toBeUndefined();
    });

    it('a pointy-bracket destination may hold the closing paren', () => {
        expect(firstToken('[a](<b)c>)', 'link')?.href).toBe('b)c');
    });

    it('a bare destination keeps balanced parens and drops the escapes', () => {
        expect(firstToken('[link](foo(and(bar)))', 'link')?.href).toBe('foo(and(bar))');
        expect(firstToken('[link](foo\\(and\\(bar\\))', 'link')?.href).toBe('foo(and(bar)');
    });

    it('a bare destination with unbalanced parens is not a link', () => {
        expect(firstToken('[link](foo(and(bar))', 'link')).toBeUndefined();
    });

    it('accepts all three title delimiters', () => {
        for (const src of ['[link](/url "title")', `[link](/url 'title')`, '[link](/url (title))']) {
            const token = firstToken(src, 'link') as LinkToken;
            expect(token?.href, src).toBe('/url');
            expect(token?.title, src).toBe('title');
        }
    });

    it('rejects what follows the title instead of treating it as one', () => {
        expect(firstToken('[link](/url "title" "extra")', 'link')).toBeUndefined();
        expect(firstToken('[link](/url "title "and" title")', 'link')).toBeUndefined();
    });

    it('requires whitespace between destination and title', () => {
        expect(firstToken('[link](/url"title")', 'link')?.href).toBe('/url"title"');
        expect(firstToken('[link](<b>"title")', 'link')).toBeUndefined();
    });

    // The `link`/`image` patterns match to the last `)` on the line, so the
    // parse is also what decides where the link stops.
    it('ends the link at its own closing paren, not the line\'s last one', () => {
        const token = firstToken('[a](b) c (d)', 'link') as LinkToken;

        expect(token.raw).toBe('[a](b)');
        expect(token.href).toBe('b');
    });

    it('does not mistake a paren inside the title for the link\'s end', () => {
        const token = firstToken('[a](/u "x)y") and (z)', 'link') as LinkToken;

        expect(token.raw).toBe('[a](/u "x)y")');
        expect(token.href).toBe('/u');
        expect(token.title).toBe('x)y');
    });

    // The renderer draws the `](…)` half of a link from `hrefAndTitle` and
    // `range`, and `format()` rebuilds the source from them, so both must keep
    // describing the raw text even though `href` no longer does.
    it('keeps the raw source on the token', () => {
        const token = firstToken('[link](</my uri> "t")', 'link') as LinkToken;

        expect(token.raw).toBe('[link](</my uri> "t")');
        expect(token.hrefAndTitle).toBe('</my uri> "t"');
        expect(token.range).toEqual({ start: 0, end: 21 });
    });

    it('keeps the raw source on an image token too', () => {
        const token = firstToken('![alt](<a b.png> "t")', 'image') as ImageToken;

        expect(token.raw).toBe('![alt](<a b.png> "t")');
        expect(token.srcAndTitle).toBe('<a b.png> "t"');
        expect(token.attrs.src).toBe('a b.png');
    });
});
