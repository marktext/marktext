// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

// pandoc's `tex_math_single_backslash` on the import / export path.
//
// `\[…\]` is not a block construct — pandoc reads it as an inline node inside
// a paragraph whether or not the delimiters sit on their own lines, and the
// paragraph boundary is what terminates it. muya models it the same way, so
// the paragraph keeps the source text verbatim and the whole document survives
// an open-and-save untouched. pandoc's own Markdown writer does not manage
// that: it normalizes every formula back to `$…$` / `$$…$$`.

interface IBlockLike {
    name: string;
    text?: string;
}

function parse(markdown: string, options: Record<string, boolean> = {}): IBlockLike[] {
    return new MarkdownToState({
        footnote: false,
        texMathDollars: true,
        texMathGfm: false,
        texMathSingleBackslash: true,
        trimUnnecessaryCodeBlockEmptyLines: false,
        frontMatter: false,
        ...options,
    } as never).generate(markdown) as unknown as IBlockLike[];
}

function roundTrip(markdown: string, options: Record<string, boolean> = {}): string {
    return new ExportMarkdown({ listIndentation: 1 } as never)
        .generate(parse(markdown, options) as never);
}

// Every rendered formula carries one `class="katex"`; a display one is wrapped
// in a further `class="katex-display"`. Returned as [formulas, of which display].
function katexCounts(src: string, options: Record<string, boolean> = {}): [number, number] {
    const html = getHighlightHtml(src, {
        texMathDollars: true,
        texMathSingleBackslash: true,
        ...options,
    });

    return [
        html.match(/class="katex"/g)?.length ?? 0,
        html.match(/class="katex-display"/g)?.length ?? 0,
    ];
}

describe('tex_math_single_backslash — the document survives a round trip', () => {
    const sources = [
        '\\(e=mc^2\\)\n',
        '\\[ x \\]\n',
        '\\[\nx\n\\]\n',
        'a\n\\[\nx\n\\]\nb\n',
        'See \\[1\\] for details.\n',
        '\\[\n  indented\n    deeper\n\\]\n',
    ];

    for (const source of sources) {
        it(`serializes ${JSON.stringify(source)} back byte for byte`, () => {
            expect(roundTrip(source)).toBe(source);
        });
    }

    it('leaves the paragraph a paragraph, with no math block in the state', () => {
        expect(parse('\\[\nx\n\\]\n').map(block => block.name)).toEqual(['paragraph']);
    });

    it('still round-trips with the extension off', () => {
        const source = '\\[\nx\n\\]\n';

        expect(roundTrip(source, { texMathSingleBackslash: false })).toBe(source);
    });
});

describe('tex_math_single_backslash — rendering on the export path', () => {
    it('renders a formula the extension claims', () => {
        expect(katexCounts('\\(e=mc^2\\)')).toEqual([1, 0]);
    });

    it('renders nothing as math when the extension is off', () => {
        expect(katexCounts('\\(e=mc^2\\)', { texMathSingleBackslash: false })).toEqual([0, 0]);
    });

    it('stands on its own when the dollar extension is not registered', () => {
        expect(katexCounts('\\(e=mc^2\\)', { texMathDollars: false })).toEqual([1, 0]);
    });

    it('draws a lone `\\[…\\]` paragraph in display mode', () => {
        expect(katexCounts('\\[e=mc^2\\]')).toEqual([1, 1]);
    });

    it('draws it inline when the paragraph holds anything else', () => {
        expect(katexCounts('See \\[x\\] here')).toEqual([1, 0]);
    });

    it('does not read across a blank line', () => {
        expect(katexCounts('\\[x\n\ny\\]')).toEqual([0, 0]);
    });

    it('round-trips the asymmetric markers through the clipboard', () => {
        const html = getClipBoardHtml('\\(e=mc^2\\)', {
            texMathDollars: true,
            texMathSingleBackslash: true,
        });

        expect(html).toContain('\\(e=mc^2\\)');
    });
});
