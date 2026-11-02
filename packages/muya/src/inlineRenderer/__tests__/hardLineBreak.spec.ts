// @vitest-environment happy-dom

import type { Token } from '../types';
import { describe, expect, it } from 'vitest';
import { generator, tokenizer } from '../lexer';

function breaks(tokens: Token[]): Token[] {
    return tokens.flatMap(token => [
        ...(token.type === 'hard_line_break' ? [token] : []),
        ...('children' in token && token.children ? breaks(token.children) : []),
    ]);
}

describe('backslash hard line breaks (#5967)', () => {
    it.each(['\\', '  ', '    '])('recognizes %j before a newline', (marker) => {
        const source = `foo${marker}\nbaz`;
        const tokens = tokenizer(source);
        expect(breaks(tokens)).toMatchObject([{
            type: 'hard_line_break',
            raw: `${marker}\n`,
            range: { start: 3, end: 4 + marker.length },
        }]);
        expect(generator(tokens)).toBe(source);
    });

    it.each([1, 2, 3, 4, 5])('respects escaping with %i backslashes', (count) => {
        const source = `foo${'\\'.repeat(count)}\nbaz`;
        const tokens = tokenizer(source);
        expect(breaks(tokens)).toHaveLength(count % 2);
        expect(generator(tokens)).toBe(source);
    });

    it.each(['*foo\\\nbar*', '**foo\\\nbar**', '[foo\\\nbar](/url)'])('recognizes breaks inside %j', (source) => {
        const tokens = tokenizer(source);
        expect(breaks(tokens)).toHaveLength(1);
        expect(generator(tokens)).toBe(source);
    });

    it.each(['foo\\', 'foo\\\n\nbar', '### foo\\', '`foo\\\nbar`', 'foo <a href="foo\\\nbar">'])('does not create a break in %j', (source) => {
        const tokens = tokenizer(source);
        expect(breaks(tokens)).toHaveLength(0);
        expect(generator(tokens)).toBe(source);
    });

    it.each(['\\', '  '])('preserves next-line indentation after %j in source ranges', (marker) => {
        const source = `foo${marker}\n     bar`;
        const tokens = tokenizer(source);
        expect(breaks(tokens)).toMatchObject([{
            marker,
            leadingSpaces: '     ',
            range: { start: 3, end: 9 + marker.length },
        }]);
        expect(tokens.at(-1)).toMatchObject({ type: 'text', content: 'bar', range: { start: 9 + marker.length, end: source.length } });
        expect(generator(tokens)).toBe(source);
    });

    it('keeps the editable trailing line break distinct from a saved block ending', () => {
        expect(breaks(tokenizer('foo\\\n'))).toMatchObject([{ isAtEnd: true }]);
        expect(breaks(tokenizer('foo\\'))).toHaveLength(0);
    });
});
