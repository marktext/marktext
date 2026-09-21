// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { tokenizer } from '../lexer';

// pandoc's `tex_math_single_backslash`: `\(…\)` inline, `\[…\]` display.
// Every expectation below was taken from pandoc 3.11 itself —
// `printf '%s' <input> | pandoc -f markdown+tex_math_single_backslash -t native`
// — because the manual leaves the escape and boundary rules implicit. The one
// deliberate divergence is display *mode*, asserted in the render cases.
const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {
        markdown,
        texMathSingleBackslash: true,
    } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function mathTokens(src: string, texMathSingleBackslash = true): CodeEmojiMathToken[] {
    return tokenizer(src, {
        options: {
            superSubScript: true,
            footnote: false,
            texMathDollars: true,
            texMathGfm: false,
            texMathSingleBackslash,
        },
    }).filter((token): token is CodeEmojiMathToken => token.type === 'inline_math');
}

function markerAndContent(src: string): Array<[string, string]> {
    return mathTokens(src).map(token => [token.marker, token.content]);
}

describe('tex_math_single_backslash — tokenizing', () => {
    const cases: Array<[markdown: string, formulas: Array<[string, string]>]> = [
        ['\\(e=mc^2\\)', [['\\(', 'e=mc^2']]],
        ['\\[ x \\]', [['\\[', ' x ']]],
        ['a \\(x\\) b', [['\\(', 'x']]],
        ['\\(a\\) and \\(b\\)', [['\\(', 'a'], ['\\(', 'b']]],
        // A formula may span a soft line break, as it may with `$…$`.
        ['open \\(a\nb\\) close', [['\\(', 'a\nb']]],
        ['\\[\nx\n\\]', [['\\[', '\nx\n']]],
        // `\\` is a literal backslash inside a formula and does not close it,
        // so the span runs on to the next unescaped closer.
        ['\\(a\\\\)b\\)', [['\\(', 'a\\\\)b']]],
        // Not math: unclosed, or empty.
        ['\\(x\\\\)', []],
        ['\\(\\)', []],
        ['\\(x', []],
        // The double-backslash spelling belongs to its own extension.
        ['\\\\(x\\\\)', []],
    ];

    for (const [markdown, formulas] of cases) {
        it(`reads ${JSON.stringify(markdown)}`, () => {
            expect(markerAndContent(markdown)).toEqual(formulas);
        });
    }
});

describe('tex_math_single_backslash — off by default, as in pandoc', () => {
    it('leaves `\\(` to the CommonMark escape', () => {
        expect(mathTokens('\\(e=mc^2\\)', false)).toHaveLength(0);

        const tokens = tokenizer('\\(e=mc^2\\)', {
            options: {
                superSubScript: true,
                footnote: false,
                texMathDollars: true,
                texMathGfm: false,
                texMathSingleBackslash: false,
            },
        });

        expect(tokens.some(token => token.type === 'backlash')).toBe(true);
    });

    it('keeps an escaped bracket out of the formula grammar', () => {
        expect(mathTokens('\\[TODO\\] item', false)).toHaveLength(0);
    });
});

describe('tex_math_single_backslash — display mode', () => {
    // muya draws a display formula in display mode only when it is all the
    // paragraph holds — the rule `$$…$$` already follows (#4904). pandoc
    // instead draws every `\[…\]` in display mode, but `.katex-display` is a
    // centred block and would break the line around it.
    const renderCases: Array<[markdown: string, display: boolean[]]> = [
        ['\\[a\\]', [true]],
        ['\\[\nx\n\\]', [true]],
        ['   \\[a\\]   ', [true]],
        ['\\[a\\] \\[b\\]', [true, true]],
        ['> \\[a\\]', [true]],
        ['- \\[a\\]', [true]],
        ['\\(a\\)', [false]],
        ['See \\[x\\] here', [false]],
        ['\\[a\\] text', [false]],
        ['# \\[a\\]', [false]],
        ['| h |\n| --- |\n| \\[d\\] |', [false]],
    ];

    for (const [markdown, display] of renderCases) {
        it(`renders ${JSON.stringify(markdown)} as ${display.map(d => (d ? 'display' : 'inline')).join(', ')} math`, () => {
            const muya = bootMuya(`${markdown}\n`);
            const wrappers = [...muya.domNode.querySelectorAll('.mu-math')];

            expect(wrappers.map(wrapper => wrapper.classList.contains('mu-display-math'))).toEqual(display);
            expect(wrappers.map(wrapper => wrapper.querySelector('.katex-display') !== null)).toEqual(display);
        });
    }

    it('maps preview offsets across the two-character markers', () => {
        const muya = bootMuya('\\[x\\]\n');
        const preview = muya.domNode.querySelector<HTMLElement>('.mu-math-render');

        expect(preview?.dataset.start).toBe('2');
        expect(preview?.dataset.end).toBe('3');
    });
});
