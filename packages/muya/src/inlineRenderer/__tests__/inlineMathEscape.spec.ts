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
});
