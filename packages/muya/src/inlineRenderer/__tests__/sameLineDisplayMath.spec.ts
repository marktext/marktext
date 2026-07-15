// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { tokenizer } from '../lexer';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function mathTokens(src: string): CodeEmojiMathToken[] {
    return tokenizer(src).filter(
        (token): token is CodeEmojiMathToken => token.type === 'inline_math',
    );
}

describe('same-line display math (#4904)', () => {
    it('tokenizes double-dollar formulas without requiring separate fence lines', () => {
        const [token] = mathTokens('Before $$ E=MC^2 $$ after');

        expect(token.marker).toBe('$$');
        expect(token.content).toBe(' E=MC^2 ');
    });

    it('does not interpret an empty $$$$ delimiter pair as math', () => {
        expect(mathTokens('$$$$')).toHaveLength(0);
    });

    it('allows a single dollar inside double-dollar math', () => {
        const [token] = mathTokens('$$x$y$$');

        expect(token.content).toBe('x$y');
    });

    it('tokenizes adjacent display formulas independently', () => {
        const tokens = mathTokens('$$a$$$$b$$');

        expect(tokens.map(token => [token.marker, token.content])).toEqual([
            ['$$', 'a'],
            ['$$', 'b'],
        ]);
    });

    it('leaves multiline double-dollar syntax to the block parser', () => {
        expect(mathTokens('$$a\nb$$')).toHaveLength(0);
    });

    it('falls back to single-dollar math when a double-dollar opener is unclosed', () => {
        const [token] = mathTokens('$$x$');

        expect(token.marker).toBe('$');
        expect(token.content).toBe('x');
    });

    it('preserves soft line breaks inside single-dollar math', () => {
        const [token] = mathTokens('$a\nb$');

        expect(token.content).toBe('a\nb');
    });

    it('renders double-dollar formulas in display mode and single-dollar formulas inline', () => {
        const muya = bootMuya('$x$ and $$x$$\n');
        const previews = muya.domNode.querySelectorAll('.mu-math-render');
        const wrappers = muya.domNode.querySelectorAll('.mu-math');

        expect(previews).toHaveLength(2);
        expect(previews[0].querySelector('.katex-display')).toBeNull();
        expect(previews[1].querySelector('.katex-display')).not.toBeNull();
        expect(wrappers[0].classList.contains('mu-display-math')).toBe(false);
        expect(wrappers[1].classList.contains('mu-display-math')).toBe(true);
    });

    it('uses the full double-dollar marker when mapping preview offsets', () => {
        const muya = bootMuya('$$x$$\n');
        const preview = muya.domNode.querySelector<HTMLElement>('.mu-math-render');

        expect(preview?.dataset.start).toBe('2');
        expect(preview?.dataset.end).toBe('3');
    });

    it('preserves the authored same-line syntax when serializing markdown', () => {
        const source = '$$ E=MC^2 $$\n';
        const muya = bootMuya(source);

        expect(muya.getMarkdown()).toBe(source);
    });
});
