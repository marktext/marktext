// @vitest-environment happy-dom

import type { IHighlight, Token } from '../types';
import { describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { union } from '../../utils';
import { matchString } from '../../utils/search';
import { tokenizer } from '../lexer';

function allTokens(tokens: Token[]): Token[] {
    return tokens.flatMap(token => [
        token,
        ...('children' in token && Array.isArray(token.children) ? allTokens(token.children) : []),
    ]);
}

describe('search highlights in large paragraphs (#3211)', () => {
    // Shared CI runners need headroom for the deliberately large DOM fixture;
    // the separate range-access budget detects performance regressions without timing noise.
    it('renders, navigates, replaces and clears matches in a 1500-line document', async () => {
        const previousVersion = window.MUYA_VERSION;
        window.MUYA_VERSION = 'test';
        const host = document.createElement('div');
        document.body.append(host);
        const muya = new Muya(host, { markdown: '**needle** and `code`\n'.repeat(1500) });

        try {
            muya.init();
            const search = muya.editor.searchModule;
            search.search('needle');
            expect(search.matches).toHaveLength(1500);
            expect(muya.domNode.querySelectorAll('span.mu-highlight')).toHaveLength(1);
            expect(muya.domNode.querySelectorAll('span.mu-selection')).toHaveLength(1499);

            search.find('next');
            expect(search.index).toBe(1);
            search.replace('thread');
            await vi.waitFor(() => expect(muya.getMarkdown()).toContain('**thread**'));
            expect(search.matches).toHaveLength(1499);

            search.search('');
            expect(muya.domNode.querySelectorAll('span.mu-highlight, span.mu-selection')).toHaveLength(0);
        }
        finally {
            muya.destroy();
            muya.domNode.remove();
            if (previousVersion === undefined)
                delete (window as Partial<Window>).MUYA_VERSION;
            else
                window.MUYA_VERSION = previousVersion;
        }
    }, 15000);

    it('does not scan every match for every token in a 1500-line paragraph', () => {
        const line = '**needle** and `code`\n';
        const count = 1500;
        let reads = 0;
        const highlights = Array.from({ length: count }, (_, index) => ({
            get start() {
                reads++;
                return index * line.length + 2;
            },
            get end() {
                reads++;
                return index * line.length + 8;
            },
            active: index === 0,
        }));

        const tokens = allTokens(tokenizer(line.repeat(count), { highlights }));

        expect(tokens.filter(token => token.type === 'strong' && token.highlights?.length)).toHaveLength(count);
        expect(tokens.filter(token => token.type === 'text' && token.highlights?.length)).toHaveLength(count);
        // Count range accesses instead of wall time so slow CI runners use the same limit.
        expect(reads).toBeLessThan(count * 200);
    });

    it.each([
        [],
        [{ start: 0, end: 35, active: true }, { start: 35, end: 36, active: false }],
        [{ start: 3, end: 3, active: true }, { start: 10, end: 10, active: false }],
        [{ start: 0, end: 6, active: false }, { start: 6, end: 10, active: true }],
        [{ start: 0, end: 12, active: false }, { start: 8, end: 20, active: true }],
        [{ start: 0, end: 10, active: false }, { start: 4, end: 10, active: true }],
        [{ start: 40, end: 45, active: true }],
    ] satisfies IHighlight[][])('keeps intersections correct for nested tokens and ordered ranges: %j', (...highlights) => {
        const tokens = allTokens(tokenizer('**one *two* three** and `code`\nnext', { highlights }));

        for (const token of tokens) {
            const expected = highlights.map(light => union(token.range, light)).filter(Boolean);
            expect(token.highlights ?? []).toEqual(expected);
        }
    });

    it.each([
        ['needle and needle', 'needle', false],
        ['a bb aaa', 'a+|b', true],
        ['aaa', '(?=a)|a', true],
        ['👩‍👩‍👧‍👦 👩‍👩‍👧‍👦', '.', true],
        ['e\u0301 e\u0301', '.', true],
    ])('produces ordered search ranges for %j', (text, query, isRegexp) => {
        const matches = matchString(text, query, { isRegexp });
        expect(matches.length).toBeGreaterThan(1);

        for (let i = 1; i < matches.length; i++) {
            const previous = matches[i - 1];
            expect(matches[i].index).toBeGreaterThanOrEqual(previous.index + previous.match.length);
        }
    });

    it('keeps block-relative coordinates for both syntax markers and nested text', () => {
        const highlight = Object.freeze({ start: 0, end: 7, active: true });
        const highlights = [highlight];
        Object.freeze(highlights);

        const [token] = tokenizer('**one**', { highlights });
        expect(token.type).toBe('strong');
        expect(token.highlights).toEqual([{ start: 0, end: 7, active: true }]);
        if (!('children' in token) || !token.children)
            throw new Error('Expected nested text');
        expect(token.children[0].highlights).toEqual([{ start: 2, end: 5, active: true }]);
        expect(highlights).toEqual([{ start: 0, end: 7, active: true }]);
    });

    it('leaves unmatched tokens without highlight annotations', () => {
        const tokens = allTokens(tokenizer('**one**', {
            highlights: [{ start: 10, end: 15, active: true }],
        }));

        expect(tokens.every(token => !Object.hasOwn(token, 'highlights'))).toBe(true);
    });
});
