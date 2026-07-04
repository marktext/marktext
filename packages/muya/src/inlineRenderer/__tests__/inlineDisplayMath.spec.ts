// @vitest-environment happy-dom

// #4782: single-line display math `$$…$$` was not rendered in the editor. The
// inline_math rule only matched a single `$` delimiter (and its trailing
// `(?!\1)` explicitly rejected a doubled `$`), so `$$a+b$$` stayed as literal
// text — even though the HTML/PDF export path (marked, `${1,2}`) rendered it.

import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { tokenizer } from '../lexer';

function mathToken(src: string): CodeEmojiMathToken | undefined {
    return tokenizer(src).find(t => t.type === 'inline_math') as
        | CodeEmojiMathToken
        | undefined;
}

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    return muya;
}

describe('inline display math $$…$$ (#4782)', () => {
    it('tokenizes single-line $$a+b$$ as inline math with a $$ marker', () => {
        const t = mathToken('$$a+b$$');
        expect(t?.content).toBe('a+b');
        expect(t?.marker).toBe('$$');
        expect(t?.raw).toBe('$$a+b$$');
    });

    it('still tokenizes single-dollar $a+b$ unchanged', () => {
        const t = mathToken('$a+b$');
        expect(t?.content).toBe('a+b');
        expect(t?.marker).toBe('$');
    });

    it('preserves an escaped dollar inside $$ math', () => {
        expect(mathToken('$$y = \\$10$$')?.content).toBe('y = \\$10');
    });

    it('does not tokenize empty $$$$', () => {
        expect(mathToken('$$$$')).toBeUndefined();
    });

    it('renders $$a+b$$ as KaTeX in the editor (display mode)', () => {
        const muya = boot('$$a+b$$\n');
        const html = muya.domNode!.innerHTML;
        expect(/katex/i.test(html)).toBe(true);
        expect(/katex-display/.test(html)).toBe(true);
    });

    it('keeps single-dollar $a+b$ rendering inline (not display)', () => {
        const muya = boot('$a+b$\n');
        const html = muya.domNode!.innerHTML;
        expect(/katex/i.test(html)).toBe(true);
        expect(/katex-display/.test(html)).toBe(false);
    });

    it('round-trips $$a+b$$ through getMarkdown', () => {
        const muya = boot('$$a+b$$\n');
        expect(muya.getMarkdown()).toContain('$$a+b$$');
    });
});
