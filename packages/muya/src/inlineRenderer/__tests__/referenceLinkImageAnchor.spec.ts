import type { ReferenceLinkToken, Token } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// #4865: a full reference link whose text is an image — `[![alt](img)][ref]`,
// the standard README-badge pattern — must tokenize as ONE reference_link
// carrying the image as its child. The anchor group used `[^\]]+?`, which
// stopped at the image's inner `]`, so the input fragmented into a bare image
// plus a separate empty reference link and the image never nested in the link.

function toks(src: string): Token[] {
    const labels = new Map([['ref', { href: 'https://example.com/dst', title: '' }]]);
    return tokenizer(src, { labels } as Parameters<typeof tokenizer>[1]);
}

describe('reference link with an image anchor (#4865)', () => {
    it('tokenizes `[![alt](img)][ref]` as a single reference_link wrapping the image', () => {
        const result = toks('[![alt](https://example.com/badge.svg)][ref]');

        expect(result).toHaveLength(1);
        const link = result[0] as ReferenceLinkToken;
        expect(link.type).toBe('reference_link');
        expect(link.isFullLink).toBe(true);
        expect(link.label).toBe('ref');

        expect(link.children).toHaveLength(1);
        const image = link.children[0] as Token & { attrs?: { src: string; alt: string } };
        expect(image.type).toBe('image');
        expect(image.attrs?.src).toBe('https://example.com/badge.svg');
        expect(image.attrs?.alt).toBe('alt');
    });

    it('still tokenizes a plain-text reference link `[text][ref]` unchanged', () => {
        const result = toks('[text][ref]');

        expect(result).toHaveLength(1);
        const link = result[0] as ReferenceLinkToken;
        expect(link.type).toBe('reference_link');
        expect(link.children).toHaveLength(1);
        expect(link.children[0].type).toBe('text');
    });

    it('does not treat `[![alt](img)][ref]` as a link when the ref is undefined', () => {
        // No matching definition ⇒ not a reference link (CommonMark); the image
        // stays a standalone image, never a fabricated link.
        const result = tokenizer('[![alt](https://example.com/badge.svg)][missing]');

        expect(result.some(t => t.type === 'reference_link')).toBe(false);
        expect(result.some(t => t.type === 'image')).toBe(true);
    });
});
