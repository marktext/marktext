// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../../state/markdownToState';
import ExportMarkdown from '../../state/stateToMarkdown';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { tokenizer } from '../lexer';

// pandoc's `tex_math_double_backslash`: `\\(…\\)` inline, `\\[…\\]` display.
// Combinable with the single-backslash extension, as pandoc's extensions are —
// the openers cannot collide, since `\\(` carries a backslash where `\(`
// carries the parenthesis. Expectations recorded from pandoc 3.11 via
// `pandoc -f markdown+tex_math_double_backslash -t native`.

function options(texMathDoubleBackslash: boolean, texMathSingleBackslash = false) {
    return {
        superSubScript: true,
        footnote: false,
        texMathDollars: true,
        texMathGfm: false,
        texMathSingleBackslash,
        texMathDoubleBackslash,
    };
}

function markerAndContent(
    src: string,
    texMathDoubleBackslash = true,
    texMathSingleBackslash = false,
): Array<[string, string]> {
    return tokenizer(src, { options: options(texMathDoubleBackslash, texMathSingleBackslash) })
        .filter((token): token is CodeEmojiMathToken => token.type === 'inline_math')
        .map(token => [token.marker, token.content]);
}

function katexCounts(src: string, opts: Record<string, boolean> = {}): [number, number] {
    const html = getHighlightHtml(src, { texMathDoubleBackslash: true, ...opts });

    return [
        html.match(/class="katex"/g)?.length ?? 0,
        html.match(/class="katex-display"/g)?.length ?? 0,
    ];
}

describe('tex_math_double_backslash — tokenizing', () => {
    const cases: Array<[markdown: string, formulas: Array<[string, string]>]> = [
        ['\\\\(e=mc^2\\\\)', [['\\\\(', 'e=mc^2']]],
        ['\\\\[ x \\\\]', [['\\\\[', ' x ']]],
        ['a \\\\(x\\\\) b', [['\\\\(', 'x']]],
        ['\\\\[\nx\n\\\\]', [['\\\\[', '\nx\n']]],
        // The closer is literal here, with none of the single-backslash escape
        // rule: the span ends at the first `\\)`.
        ['\\\\(a\\\\)b\\\\)', [['\\\\(', 'a']]],
        ['\\\\(a\\\\\\\\)b\\\\)', [['\\\\(', 'a\\\\']]],
        // Not math: unclosed, or empty.
        ['\\\\(x', []],
        ['\\\\(\\\\)', []],
        // The single-backslash spelling belongs to its own extension.
        ['\\(x\\)', []],
    ];

    for (const [markdown, formulas] of cases) {
        it(`reads ${JSON.stringify(markdown)}`, () => {
            expect(markerAndContent(markdown)).toEqual(formulas);
        });
    }
});

describe('tex_math_double_backslash — alongside the single-backslash extension', () => {
    it('claims the double spelling when both are on', () => {
        expect(markerAndContent('\\\\(x\\\\)', true, true)).toEqual([['\\\\(', 'x']]);
    });

    it('leaves the single spelling to the other extension', () => {
        expect(markerAndContent('\\(x\\)', true, true)).toEqual([['\\(', 'x']]);
    });

    it('reads both spellings in one paragraph', () => {
        expect(markerAndContent('\\(a\\) and \\\\(b\\\\)', true, true)).toEqual([
            ['\\(', 'a'],
            ['\\\\(', 'b'],
        ]);
    });
});

describe('tex_math_double_backslash — off by default, as in pandoc', () => {
    it('leaves the opener to the CommonMark escape', () => {
        expect(markerAndContent('\\\\(e=mc^2\\\\)', false)).toHaveLength(0);
    });

    it('does not render it as math on the export path either', () => {
        expect(katexCounts('\\\\(e=mc^2\\\\)', { texMathDoubleBackslash: false })).toEqual([0, 0]);
    });
});

describe('tex_math_double_backslash — the document survives a round trip', () => {
    // Like `\\[…\\]`, this never becomes a block, so the paragraph keeps the
    // source text and an open-and-save leaves the file alone.
    const sources = ['\\\\(e=mc^2\\\\)\n', '\\\\[ x \\\\]\n', '\\\\[\n  x\n\\\\]\n'];

    for (const source of sources) {
        it(`serializes ${JSON.stringify(source)} back byte for byte`, () => {
            const states = new MarkdownToState({
                footnote: false,
                texMathDollars: true,
                texMathGfm: false,
                texMathSingleBackslash: false,
                texMathDoubleBackslash: true,
                trimUnnecessaryCodeBlockEmptyLines: false,
                frontMatter: false,
            } as never).generate(source);

            expect(new ExportMarkdown({ listIndentation: 1 } as never).generate(states)).toBe(source);
        });
    }
});

describe('tex_math_double_backslash — on the export path', () => {
    it('renders an inline formula', () => {
        expect(katexCounts('\\\\(e=mc^2\\\\)')).toEqual([1, 0]);
    });

    it('draws a lone `\\\\[…\\\\]` paragraph in display mode', () => {
        expect(katexCounts('\\\\[e=mc^2\\\\]')).toEqual([1, 1]);
    });

    it('draws it inline when the paragraph holds anything else', () => {
        expect(katexCounts('See \\\\[x\\\\] here')).toEqual([1, 0]);
    });

    it('round-trips the markers through the clipboard', () => {
        const html = getClipBoardHtml('\\\\(e=mc^2\\\\)', { texMathDoubleBackslash: true });

        expect(html).toContain('\\\\(e=mc^2\\\\)');
    });
});
