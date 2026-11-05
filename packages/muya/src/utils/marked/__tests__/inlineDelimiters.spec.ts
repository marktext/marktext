// @vitest-environment happy-dom

// @ts-expect-error commonmark-spec is plain CommonJS without types
import cms from 'commonmark-spec';
import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';
import inlineDelimitersExtension from '../extensions/inlineDelimiters';
import { getClipBoardHtml } from '../getClipboardHtml';
import { getHighlightHtml } from '../getHighlightHtml';
import regressions from './fixtures/emphasis-context-regressions.json';
import gfmRegressions from './fixtures/gfm-delimiter-regressions.json';

interface ISpecExample {
    markdown: string;
    html: string;
    section: string;
    number: number;
}

const emphasisExamples = (cms.tests as ISpecExample[]).filter(
    example => example.section === 'Emphasis and strong emphasis',
);

// CommonMark fixtures use self-closing void tags; Marked emits HTML5.
function normalize(html: string): string {
    return html.replace(/\s*\/>/g, '>');
}

const CASES = [
    ['***.a*', '**<em>.a</em>'],
    ['**(a)*', '*<em>(a)</em>'],
    ['foo ***!bar*', 'foo **<em>!bar</em>'],
    ['a*b**', 'a*b**'],
    ['x a*b** y', 'x a*b** y'],
    ['__(_*', '__(_*'],
    ['**a*b*c', '**a<em>b</em>c'],
] as const;

describe('marked inline delimiters with CJK boundaries', () => {
    it('loads every CommonMark 0.31 emphasis example', () => {
        expect(emphasisExamples).toHaveLength(132);
    });

    for (const [name, render] of [['clipboard', getClipBoardHtml], ['export', getHighlightHtml]] as const) {
        // Includes seed 20261027 counterexamples; fixed commonmark.js 0.31.2 HTML keeps CI offline.
        it.each(regressions)(`${name}: $markdown retains outer delimiter context`, ({ markdown, html }) => {
            expect(normalize(render(markdown, { superSubScript: false, texMathDollars: false }))).toBe(normalize(html));
        });

        it.each(CASES)(`${name}: %s follows whole delimiter run rules`, (markdown, expected) => {
            expect(render(markdown, { superSubScript: false })).toBe(`<p>${expected}</p>\n`);
        });

        it.each(gfmRegressions)(`${name}: $markdown preserves GFM delimiter precedence`, ({ markdown, html }) => {
            expect(render(markdown, { superSubScript: false, texMathDollars: false })).toBe(html);
        });

        it.each([
            ['中文**"加粗"**中文', '中文<strong>&quot;加粗&quot;</strong>中文'],
            ['**来源：**2013年', '<strong>来源：</strong>2013年'],
            ['**核查／边界：**HTML 内容', '<strong>核查／边界：</strong>HTML 内容'],
            ['**说明：**html', '<strong>说明：</strong>html'],
            ['**𠀀：**123', '<strong>𠀀：</strong>123'],
            ['**来源：**2013年 **格式：**HTML', '<strong>来源：</strong>2013年 <strong>格式：</strong>HTML'],
            ['*说明 **来源：**2013年*', '<em>说明 <strong>来源：</strong>2013年</em>'],
            ['[**来源：**2013年](/source)', '<a href="/source"><strong>来源：</strong>2013年</a>'],
            ['`**来源：**2013年`', '<code>**来源：**2013年</code>'],
            ['**Label：**HTML', '**Label：**HTML'],
            ['**来源:**2013', '**来源:**2013'],
            ['*来源：*2013', '*来源：*2013'],
            ['__来源：__2013', '__来源：__2013'],
            ['**来源，**2013', '**来源，**2013'],
            ['𠀀**(加粗)**𠀁', '𠀀<strong>(加粗)</strong>𠀁'],
            ['𫝀**"加粗"**𬺰', '𫝀<strong>&quot;加粗&quot;</strong>𬺰'],
        ])(`${name}: %s preserves CJK emphasis`, (markdown, expected) => {
            expect(render(markdown)).toBe(`<p>${expected}</p>\n`);
        });
    }

    it.each([false, true])('keeps upstream delimiter rules with gfm=%s', (gfm) => {
        const marked = new Marked(inlineDelimitersExtension(), { gfm });
        for (const [markdown, expected] of CASES)
            expect(marked.parseInline(markdown), markdown).toBe(expected);
    });

    for (const gfm of [false, true]) {
        const marked = new Marked(inlineDelimitersExtension(), { gfm });
        it.each(regressions)(`gfm=${gfm}: $markdown retains outer delimiter context`, ({ markdown, html }) => {
            expect(normalize(marked.parse(markdown) as string)).toBe(normalize(html));
        });

        it.each(emphasisExamples)(`gfm=${gfm}: CommonMark emphasis #$number`, ({ markdown, html }) => {
            expect(marked.parse(markdown)).toBe(html);
        });

        it(`gfm=${gfm}: leaves a long unmatched delimiter run literal`, () => {
            const markdown = `${'*'.repeat(20000)}(`;
            expect(marked.parseInline(markdown)).toBe(markdown);
        });
    }

    it('does not change the grammar of other Marked instances', () => {
        const markdown = '中文**"加粗"**中文';
        const plain = new Marked();
        const before = plain.parse(markdown);

        expect(new Marked(inlineDelimitersExtension()).parse(markdown)).toContain('<strong>');
        expect(plain.parse(markdown)).toBe(before);
        expect(new Marked().parse(markdown)).toBe(before);
        expect(before).not.toContain('<strong>');
    });

    it.each(emphasisExamples)('follows CommonMark emphasis #$number with CJK compatibility disabled', ({ markdown, html }) => {
        const marked = new Marked(inlineDelimitersExtension(false), { gfm: false });
        expect(marked.parse(markdown)).toBe(html);
    });

    it('keeps CJK options isolated between Marked instances', () => {
        const source = '中文**"加粗"**中文';
        const standard = new Marked(inlineDelimitersExtension(false));
        const compatible = new Marked(inlineDelimitersExtension());
        expect(compatible.parse(source)).toContain('<strong>');
        expect(standard.parse(source)).not.toContain('<strong>');
        expect(compatible.parse(source)).toContain('<strong>');
    });
});
