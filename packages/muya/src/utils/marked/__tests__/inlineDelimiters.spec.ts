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
            ['𠀀**(加粗)**𠀁', '𠀀<strong>(加粗)</strong>𠀁'],
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
});
