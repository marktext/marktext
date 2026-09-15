import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

function mathToken(src: string): CodeEmojiMathToken | undefined {
    return tokenizer(src).find(t => t.type === 'inline_math') as
        | CodeEmojiMathToken
        | undefined;
}

describe('inline lexer — TeX \\( \\) / \\[ \\] delimiters', () => {
    it('tokenizes \\( ... \\) as inline_math', () => {
        const token = mathToken('The formula \\(E = mc^2\\) is well known.');
        expect(token?.content).toBe('E = mc^2');
        expect(token?.marker).toBe('\\(');
    });

    it('keeps LaTeX backslashes inside \\( ... \\)', () => {
        expect(mathToken('\\(x_i = \\frac{a_i}{b_i}\\)')?.content)
            .toBe('x_i = \\frac{a_i}{b_i}');
    });

    it('tokenizes mid-paragraph \\[ ... \\] as inline_math with display marker', () => {
        const token = mathToken('see \\[E = mc^2\\] here');
        expect(token?.content).toBe('E = mc^2');
        expect(token?.marker).toBe('\\[');
    });

    it('still tokenizes $...$ unchanged', () => {
        expect(mathToken('$E = mc^2$')?.content).toBe('E = mc^2');
        expect(mathToken('$E = mc^2$')?.marker).toBe('$');
    });

    it('does not treat inline code as math', () => {
        const tokens = tokenizer('`\\[x\\]`');
        expect(tokens.some(t => t.type === 'inline_math')).toBe(false);
        expect(tokens.some(t => t.type === 'inline_code')).toBe(true);
    });

    it('leaves an unmatched \\[ as a CommonMark escape, not math', () => {
        const tokens = tokenizer('\\[foo');
        expect(tokens.some(t => t.type === 'inline_math')).toBe(false);
    });

    it('does not treat a literal backslash plus \\[ as math', () => {
        const tokens = tokenizer('\\\\[x\\\\]');
        expect(tokens.some(t => t.type === 'inline_math')).toBe(false);
    });
});
