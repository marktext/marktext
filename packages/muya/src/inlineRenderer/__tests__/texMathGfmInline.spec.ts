// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { tokenizer } from '../lexer';

// The inline half of pandoc's `tex_math_gfm` — GitHub's `` $`e=mc^2`$ `` —
// which #5446 measured as silently mis-rendered: the dollar rule claimed the
// span and handed the backticks to KaTeX as part of the formula, with
// `katex-error` false. Like the tex_math_dollars spec, every row runs through
// both tokenizers, because the editor and the export have to agree.
// Expected contents of the gfm spans only; a `$…$` span on the same line is
// filtered out by marker, which is itself the point of the fourth row.
const cases: Array<[markdown: string, formulas: string[]]> = [
    ['$`e=mc^2`$', ['e=mc^2']],
    ['a $`x+y`$ b', ['x+y']],
    ['$`a`$ and $`b`$', ['a', 'b']],
    ['$`a`$ and $x+y$', ['a']],
    // Not math: no closer, empty content, or the two markers crossed.
    ['$`e=mc^2$', []],
    ['$``$', []],
    ['`$e=mc^2$`', []],
];

function editorFormulas(src: string, texMathGfm: boolean): string[] {
    return tokenizer(src, {
        options: { superSubScript: true, footnote: false, texMathDollars: true, texMathGfm },
    })
        .filter((token): token is CodeEmojiMathToken => token.type === 'inline_math')
        .filter(token => token.marker === '$`')
        .map(token => token.content);
}

function exportedFormulaCount(src: string, texMathGfm: boolean): number {
    const html = getHighlightHtml(src, { texMathDollars: true, texMathGfm });
    return html.match(/class="katex(?:-error)?"/g)?.length ?? 0;
}

describe('tex_math_gfm — inline `$`…`$`', () => {
    for (const [markdown, formulas] of cases) {
        it(`reads ${JSON.stringify(markdown)} in the editor`, () => {
            expect(editorFormulas(markdown, true)).toEqual(formulas);
        });
    }

    it('hands KaTeX the formula alone, without the backticks', () => {
        const html = getHighlightHtml('$`e=mc^2`$', { texMathDollars: true, texMathGfm: true });
        expect(html).toContain('class="katex"');
        expect(html).not.toContain('`');
    });

    it('still finds a gfm formula later on the line', () => {
        expect(exportedFormulaCount('cost $5 then $`x+y`$', true)).toBe(1);
    });

    it('round-trips the asymmetric markers through the clipboard', () => {
        const html = getClipBoardHtml('$`e=mc^2`$', { texMathDollars: true, texMathGfm: true });
        expect(html).toContain('$`e=mc^2`$');
    });
});

describe('tex_math_gfm — off by default, as in pandoc', () => {
    it('leaves the span to the dollar rule when the extension is off', () => {
        expect(editorFormulas('$`e=mc^2`$', false)).toEqual([]);

        const dollarTokens = tokenizer('$`e=mc^2`$', {
            options: { superSubScript: true, footnote: false, texMathDollars: true, texMathGfm: false },
        }).filter((token): token is CodeEmojiMathToken => token.type === 'inline_math');

        expect(dollarTokens).toHaveLength(1);
        expect(dollarTokens[0].content).toBe('`e=mc^2`');
    });

    it('does not render it as math on the export path either', () => {
        const html = getHighlightHtml('$`e=mc^2`$', { texMathDollars: true, texMathGfm: false });
        expect(html).toContain('`');
    });
});
