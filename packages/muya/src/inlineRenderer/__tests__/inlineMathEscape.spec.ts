// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// #4555: an escaped dollar `\$` inside an inline math span ($...$) broke the
// block's rendering. The inline_math content group did not allow backslash
// escapes, so the inner `\$` was read as the closing delimiter and the math
// expression was truncated / mis-tokenized.
function mathContent(src: string): string | undefined {
    const token = tokenizer(src).find(t => t.type === 'inline_math') as
        | CodeEmojiMathToken
        | undefined;
    return token?.content;
}

describe('inline math — escaped dollar (#4555)', () => {
    it('keeps an escaped \\$ inside the math expression', () => {
        expect(mathContent('$y = \\$10000$')).toBe('y = \\$10000');
    });

    it('still tokenizes a plain $a+b$ unchanged', () => {
        expect(mathContent('$a+b$')).toBe('a+b');
    });

    it('tokenizes double dollar $$x = 1$$', () => {
        expect(mathContent('$$x = 1$$')).toBe('x = 1');
    });

    it('tokenizes double dollar with escaped \\$ $$y = \\$10000$$', () => {
        expect(mathContent('$$y = \\$10000$$')).toBe('y = \\$10000');
    });

    it('sets correct marker for single and double dollar tokens', () => {
        const singleToken = tokenizer('$x$').find(t => t.type === 'inline_math') as CodeEmojiMathToken;
        expect(singleToken.marker).toBe('$');

        const doubleToken = tokenizer('$$x$$').find(t => t.type === 'inline_math') as CodeEmojiMathToken;
        expect(doubleToken.marker).toBe('$$');
    });
});
