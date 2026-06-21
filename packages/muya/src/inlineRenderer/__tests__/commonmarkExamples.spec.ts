// @vitest-environment happy-dom

import type { ImageToken, LinkToken, StrongEmToken, SuperSubScriptToken, Token } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// Narrowing helpers — extract a specific token kind out of the inline Token
// union by literal `type` field. Mirrors the runtime `find(t => t.type === X)`
// shape so tests can drop their `as any` casts.
function findByType<TType extends Token['type']>(
    tokens: Token[],
    type: TType,
): Extract<Token, { type: TType }> | undefined {
    return tokens.find(t => t.type === type) as Extract<Token, { type: TType }> | undefined;
}

// Defensive regression tests for the CommonMark 0.29 spec examples that the
// legacy marktext inline lexer used to fail before commit 57cd04c5 (Apr 2019,
// marktext PR #957). The new muya's inline lexer (`validateEmphasize` +
// `lowerPriority`) implements the CommonMark left/right-flanking rules and
// the §6.4 rule that "inline code spans, links, images, and HTML tags group
// more tightly than emphasis", so these inputs are already correct. We lock
// the behaviour in so future inline-lexer refactors can't regress it.
//
// We assert on the *shape* of the resulting token stream rather than running
// the full markdown→HTML pipeline, because the inline lexer is what marktext
// patched and what the new muya forked from.

function topTypes(src: string): string[] {
    return tokenizer(src).map(t => t.type);
}

describe('inline lexer — CommonMark 0.29 spec examples (marktext 57cd04c5)', () => {
    // §6.4 example 475 — `**<a href="**">`
    // Stars are inside an HTML attribute value, so neither pair may open or
    // close a strong-emphasis span. Output should be `<p>**<a href="**"></p>`.
    it('example 475: `**` inside an HTML attribute does not start strong', () => {
        const types = topTypes('**<a href="**">');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('strong');
        expect(types).not.toContain('em');
    });

    // §6.4 example 353 — `* a *` with non-breaking spaces (U+00A0) around `a`.
    // Non-breaking space counts as Unicode whitespace, so the surrounding `*`
    // markers are followed/preceded by whitespace and cannot open emphasis.
    it('example 353: `*` adjacent to non-breaking space does not open em', () => {
        const types = topTypes('* a *');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('em');
        expect(types).not.toContain('strong');
    });

    // §6.4 example 387 — `пристаням__стремятся__`
    // The intraword `__` rule says `_` flanked by alphanumerics on both sides
    // cannot open or close emphasis. Output is literal text.
    it('example 387: intraword `__` does not open em or strong', () => {
        const types = topTypes('пристаням__стремятся__');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('em');
        expect(types).not.toContain('strong');
    });

    // §6.6 example 520 — `[foo <bar attr="](baz)">`
    // The HTML tag spans across what would otherwise be a link closer, and
    // because HTML tags have higher precedence than links the input emits an
    // html_tag (or plain text), never a link.
    it('example 520: HTML tag takes precedence over a tentative link', () => {
        const types = topTypes('[foo <bar attr="](baz)">');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('link');
        expect(types).not.toContain('reference_link');
    });

    // §6.6 example 521 — `[foo` + backtick code span + `](/uri)`
    // A code span sits inside what looks like a link, but code spans take
    // precedence, so the link never forms.
    it('example 521: code span takes precedence over a tentative link', () => {
        const types = topTypes('[foo`](/uri)`');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('link');
        expect(types).not.toContain('reference_link');
        expect(types).toContain('inline_code');
    });
});

// Defensive regression for marktext commit d9f64bab (issue #921, PR #947):
// reference_link `[text][label]` requires the label to be defined in the
// `labels` map. Without the definition, the input must stay as text — the
// new muya's lexer enforces this via `labels.has(...)` (lexer.ts:357).
describe('inline lexer — reference link (marktext d9f64bab)', () => {
    it('does not emit reference_link when label is undefined', () => {
        const types = topTypes('[text][undefined-label]');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('reference_link');
    });

    it('emits reference_link when label is defined', () => {
        const labels = new Map<string, { href: string; title: string }>([
            ['ref', { href: 'http://example.com', title: '' }],
        ]);
        const tokens = tokenizer('[text][ref]', { labels });
        const types = tokens.map(t => t.type);
        expect(types, `tokens: ${JSON.stringify(types)}`).toContain('reference_link');
    });
});

// Defensive regression for marktext commit 8e32838b (PR #1531) — sup/sub
// inline syntax `^foo^` (superscript) and `~bar~` (subscript). Already
// present in the new muya's inline lexer rules + renderer.
describe('inline lexer — superscript/subscript (marktext 8e32838b)', () => {
    it('parses ^foo^ as a super_sub_script token with `^` marker', () => {
        const tokens = tokenizer('text^sup^');
        const sup = findByType(tokens, 'super_sub_script') as SuperSubScriptToken;
        expect(sup, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBeDefined();
        expect(sup.marker).toBe('^');
        expect(sup.content).toBe('sup');
    });

    it('parses ~bar~ as a super_sub_script token with `~` marker', () => {
        const tokens = tokenizer('text~sub~');
        const sub = findByType(tokens, 'super_sub_script') as SuperSubScriptToken;
        expect(sub, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBeDefined();
        expect(sub.marker).toBe('~');
        expect(sub.content).toBe('sub');
    });

    it('does not parse ^...^ when surrounded by whitespace', () => {
        // Per the spec, the marker must abut non-whitespace on both sides.
        const types = topTypes('text ^ foo ^ bar');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('super_sub_script');
    });
});

// Defensive regression for marktext commit c0853f64 (PR #1421):
// auto_link (`<https://x.com>`) and the GFM auto_link_extension
// (`https://x.com` and `www.x.com` without angle brackets) are both wired
// up in the new muya inline lexer, with the same boundary guard the
// marktext fix introduced (`top && (pos === 0 || /[* _~(]{1}/...))`).
describe('inline lexer — auto link (marktext c0853f64)', () => {
    it('parses angle-bracket autolink as auto_link', () => {
        const types = topTypes('<https://example.com>');
        expect(types, `tokens: ${JSON.stringify(types)}`).toContain('auto_link');
    });

    it('parses bare URL as auto_link_extension (GFM)', () => {
        const types = topTypes('https://example.com/path');
        expect(types, `tokens: ${JSON.stringify(types)}`).toContain('auto_link_extension');
    });

    it('parses bare www URL as auto_link_extension', () => {
        const types = topTypes('www.example.com');
        expect(types, `tokens: ${JSON.stringify(types)}`).toContain('auto_link_extension');
    });

    it('does not start an extension autolink inside a word', () => {
        // The boundary guard requires the char before to be one of [* _~(]
        // or the start of input. `xhttps://...` should not autolink.
        const types = topTypes('xhttps://example.com');
        expect(types, `tokens: ${JSON.stringify(types)}`).not.toContain('auto_link_extension');
    });
});

// Defensive regression for marktext commit ad5ddbf9 (GFM example 558, PR #917):
// the legacy muya parser used to drop the `"title"` portion of a link or image
// destination. The new muya's `parseSrcAndTitle` in inlineRenderer/utils.ts
// already splits these, so this test locks the behaviour in.
describe('inline lexer — GFM link/image title (marktext ad5ddbf9)', () => {
    it('extracts title from a link with double-quoted title', () => {
        const tokens = tokenizer('[text](http://example.com "Example title")');
        const link = findByType(tokens, 'link') as LinkToken;
        expect(link).toBeDefined();
        expect(link.href).toBe('http://example.com');
        expect(link.title).toBe('Example title');
    });

    it('extracts title from a link with single-quoted title', () => {
        const tokens = tokenizer(`[text](http://example.com 'Example title')`);
        const link = findByType(tokens, 'link') as LinkToken;
        expect(link).toBeDefined();
        expect(link.href).toBe('http://example.com');
        expect(link.title).toBe('Example title');
    });

    it('extracts title from an image', () => {
        const tokens = tokenizer('![alt](http://example.com/x.png "Pic title")');
        const image = findByType(tokens, 'image') as ImageToken;
        expect(image).toBeDefined();
        expect(image.src).toBe('http://example.com/x.png');
        expect(image.title).toBe('Pic title');
    });

    it('leaves title empty when the destination has no title', () => {
        const tokens = tokenizer('[text](http://example.com)');
        const link = findByType(tokens, 'link') as LinkToken;
        expect(link).toBeDefined();
        expect(link.href).toBe('http://example.com');
        expect(link.title).toBe('');
    });
});

// Defensive regression for marktext commit d937fac0 (issue #1071, PR #1072):
// a sequence like `**\`word 1\`**, **\`word 2\`**` used to only bold the LAST
// instance — every earlier `**` pair was emitted as literal text. The legacy
// `lowerPriority` walked every position in the candidate span without
// remembering which characters were already consumed by an earlier matching
// rule, so an inline_code span ending mid-span fooled the strong rule into
// thinking another rule extended past the closer. The fix tracked already-
// consumed positions in an `ignoreIndex` array. The new muya's lowerPriority
// (`inlineRenderer/utils.ts`) already has the same `ignoreIndex`, so this
// lock-in protects against a future regression.
describe('inline lexer — repeated bold + inline_code (marktext d937fac0 / #1071)', () => {
    it('emits a strong token for EVERY `**`-wrapped code span in a sequence', () => {
        const tokens = tokenizer('**`word 1`**, **`word 2`**, **`word 3`**');
        const strongs = tokens.filter(t => t.type === 'strong');
        expect(strongs.length, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBe(3);
        // And each strong must contain a code span, not literal text.
        for (const strong of strongs) {
            const innerTypes = (strong as StrongEmToken).children.map(c => c.type);
            expect(innerTypes).toContain('inline_code');
        }
    });

    it('does not flip the bug to em (single `*` + code) either', () => {
        const tokens = tokenizer('*`word 1`*, *`word 2`*, *`word 3`*');
        const ems = tokens.filter(t => t.type === 'em');
        expect(ems.length, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBe(3);
    });
});

// Defensive regression for marktext commit 57af8304 (issue #1169, PR #1170):
// link / image destinations containing parens used to consume too much,
// eating past the real closing `)`. The fix calls `findClosingBracket` to
// pick the matching `)` and rewrites the captured groups so `\` escapes
// land in the right slot. The new muya's `correctUrl` (utils.ts) ports the
// same algorithm.
describe('inline lexer — link / image dest with parens (marktext 57af8304 / #1169)', () => {
    it('parses image dest containing balanced parens correctly', () => {
        const tokens = tokenizer('![alt](path/to/(file).png)');
        const image = findByType(tokens, 'image') as ImageToken;
        expect(image, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBeDefined();
        expect(image.src).toBe('path/to/(file).png');
    });

    it('parses link dest containing balanced parens correctly', () => {
        const tokens = tokenizer('[text](path/to/(file).html)');
        const link = findByType(tokens, 'link') as LinkToken;
        expect(link, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBeDefined();
        expect(link.href).toBe('path/to/(file).html');
    });

    it('stops at the FIRST matching `)` when more `)` appear later on the line', () => {
        // This is the real shape of the marktext regression: greedy `(.*)` in
        // the image regexp would gobble all the way to the LAST `)`, swallowing
        // both `first.png` and the `(parens)` text. `correctUrl` /
        // `findClosingBracket` walks the destination to the matching `)` so
        // the image stops at `first.png` and the rest stays as following text.
        const tokens = tokenizer('see ![alt](first.png) and also (parens) here');
        const image = findByType(tokens, 'image') as ImageToken;
        expect(image, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBeDefined();
        expect(image.src).toBe('first.png');
        // The trailing text — including the unrelated `(parens)` group — must
        // remain outside the image token. Every Token in our union carries a
        // `raw` field; `?? ''` defends against the rare extension token type
        // that may omit it.
        const joined = tokens.map(t => t.raw ?? '').join('');
        expect(joined).toContain('and also (parens) here');
        expect(image.raw).not.toContain('parens');
    });
});

// Regression for marktext #3778. `lowerPriority` scanned every position for a
// higher-priority construct (inline math/code/links) that would overlap the
// emphasis, but treated an escaped `\$` as a real `$` math delimiter — so the
// first `**bold**` on a line that also contained a later `\$` was suppressed.
describe('inline lexer — bold with escaped dollar signs (#3778)', () => {
    it('emits a strong token for every `**`-wrapped span containing an escaped `$`', () => {
        const tokens = tokenizer('It costs **\\$20** to **\\$30** online.');
        const strongs = tokens.filter(t => t.type === 'strong');
        expect(strongs.length, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBe(2);
    });

    it('still emits em for `*`-wrapped spans containing an escaped `$`', () => {
        const tokens = tokenizer('a *\\$1* and *\\$2* b');
        const ems = tokens.filter(t => t.type === 'em');
        expect(ems.length, `tokens: ${JSON.stringify(tokens.map(t => t.type))}`).toBe(2);
    });
});
