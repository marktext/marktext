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

// #5365: a `$` followed by a long backslash run and no closing `$` made the
// inline_math regex backtrack quadratically (131,072 backslashes took ~6.6s).
describe('inline math — backslash runs (#5365)', () => {
    it('closes after an escaped backslash', () => {
        expect(mathContent('$a\\\\$')).toBe('a\\\\');
    });

    it('does not close on an escaped dollar', () => {
        expect(mathContent('$a\\$')).toBeUndefined();
    });

    it('tokenizes an unclosed dollar before a long backslash run in linear time', () => {
        const started = performance.now();
        const content = mathContent(`$${'\\'.repeat(131072)}`);
        const elapsed = performance.now() - started;

        expect(content).toBeUndefined();
        expect(elapsed).toBeLessThan(1000);
    });
});
