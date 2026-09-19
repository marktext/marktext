// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tokenizer } from '../../inlineRenderer/lexer';
import { Muya } from '../../muya';

// `texMathDollars` gates both halves of pandoc's `tex_math_dollars`, on both
// tokenizers — the marked parse that decides block structure and the inline
// lexer that decides what renders as a formula. The toggle therefore has to
// re-parse (it is in PARSE_AFFECTING_OPTIONS), and it has to be lossless:
// a `$$…$$` block demoted to a paragraph keeps its source text, so turning the
// option back on restores the block. #5446.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, options: Partial<ConstructorParameters<typeof Muya>[1]> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// eslint-disable-next-line ts/no-explicit-any
function firstBlock(muya: Muya): any {
    return muya.getState()[0];
}

function mathTokenCount(src: string, texMathDollars: boolean): number {
    return tokenizer(src, {
        options: { superSubScript: true, footnote: false, texMathDollars, texMathGfm: false },
    }).filter(token => token.type === 'inline_math').length;
}

const MATH_BLOCK = '$$\nx^2\n$$\n';

describe('texMathDollars — the inline lexer', () => {
    it('reads `$x+y$` as a formula when on', () => {
        expect(mathTokenCount('a $x+y$ b', true)).toBe(1);
    });

    it('reads nothing as a formula when off', () => {
        expect(mathTokenCount('a $x+y$ b', false)).toBe(0);
        expect(mathTokenCount('a $$E=mc^2$$ b', false)).toBe(0);
    });
});

describe('texMathDollars — live toggle re-parses `$$…$$`', () => {
    it('starts as a math block when on', () => {
        const muya = bootMuya(MATH_BLOCK, { texMathDollars: true });
        expect(firstBlock(muya).name).toBe('math-block');
    });

    it('never builds the block when off', () => {
        const muya = bootMuya(MATH_BLOCK, { texMathDollars: false });
        expect(firstBlock(muya).name).toBe('paragraph');
    });

    it('demotes an existing math block to a paragraph when toggled OFF, keeping the source', () => {
        const muya = bootMuya(MATH_BLOCK, { texMathDollars: true });
        expect(firstBlock(muya).name).toBe('math-block');

        muya.setOptions({ texMathDollars: false }, true);

        expect(firstBlock(muya).name).toBe('paragraph');
        expect(muya.getMarkdown()).toBe(MATH_BLOCK);
    });

    it('restores the block when toggled back ON — the round trip is lossless', () => {
        const muya = bootMuya(MATH_BLOCK, { texMathDollars: false });

        muya.setOptions({ texMathDollars: true }, true);

        expect(firstBlock(muya).name).toBe('math-block');
        expect(muya.getMarkdown()).toBe(MATH_BLOCK);
    });

    it('leaves a ```math block alone — that one belongs to tex_math_gfm', () => {
        const muya = bootMuya('```math\nx^2\n```\n', {
            texMathDollars: false,
            texMathGfm: true,
        });
        expect(firstBlock(muya).name).toBe('math-block');
        expect(firstBlock(muya).meta.mathStyle).toBe('gfm');
    });
});
