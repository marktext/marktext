// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { tokenizer } from '../lexer';

// pandoc's `tex_math_single_backslash`: `\(…\)` inline, `\[…\]` display.
// Every expectation below was taken from pandoc 3.11 itself —
// `printf '%s' <input> | pandoc -f markdown+tex_math_single_backslash -t native`
// — because the manual leaves the escape and boundary rules implicit. Display mode is covered alongside dollar math in mathDisplay.spec.ts.
function mathTokens(src: string, texMathSingleBackslash = true): CodeEmojiMathToken[] {
    return tokenizer(src, {
        options: {
            superSubScript: true,
            footnote: false,
            texMathDollars: true,
            texMathGfm: false,
            texMathSingleBackslash,
            texMathDoubleBackslash: false,
            highlightSyntax: false,
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
                texMathDoubleBackslash: false,
                highlightSyntax: false,
            },
        });

        expect(tokens.some(token => token.type === 'backlash')).toBe(true);
    });

    it('keeps an escaped bracket out of the formula grammar', () => {
        expect(mathTokens('\\[TODO\\] item', false)).toHaveLength(0);
    });
});
