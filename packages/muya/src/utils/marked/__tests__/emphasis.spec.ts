// @vitest-environment happy-dom

import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';
import cjkEmStrongExtension from '../extensions/cjkEmStrong';
import { getClipBoardHtml } from '../getClipboardHtml';
import { getHighlightHtml } from '../getHighlightHtml';

const CASES = [
    ['***.a*', '**<em>.a</em>'],
    ['**(a)*', '*<em>(a)</em>'],
    ['foo ***!bar*', 'foo **<em>!bar</em>'],
    ['a*b**', 'a*b**'],
    ['x a*b** y', 'x a*b** y'],
    ['__(_*', '__(_*'],
    ['**a*b*c', '**a<em>b</em>c'],
] as const;

describe('marked emphasis with CJK boundaries', () => {
    for (const [name, render] of [['clipboard', getClipBoardHtml], ['export', getHighlightHtml]] as const) {
        it.each(CASES)(`${name}: %s follows whole delimiter run rules`, (markdown, expected) => {
            expect(render(markdown, { superSubScript: false })).toBe(`<p>${expected}</p>\n`);
        });

        it.each([
            ['中文**"加粗"**中文', '中文<strong>&quot;加粗&quot;</strong>中文'],
            ['𠀀**(加粗)**𠀁', '𠀀<strong>(加粗)</strong>𠀁'],
        ])(`${name}: %s preserves CJK emphasis`, (markdown, expected) => {
            expect(render(markdown)).toBe(`<p>${expected}</p>\n`);
        });
    }

    it.each([false, true])('keeps upstream delimiter rules with gfm=%s', (gfm) => {
        const marked = new Marked(cjkEmStrongExtension(), { gfm });
        for (const [markdown, expected] of CASES)
            expect(marked.parseInline(markdown), markdown).toBe(expected);
    });

    it('does not change the grammar of other Marked instances', () => {
        const markdown = '中文**"加粗"**中文';
        const plain = new Marked();
        const before = plain.parse(markdown);

        expect(new Marked(cjkEmStrongExtension()).parse(markdown)).toContain('<strong>');
        expect(plain.parse(markdown)).toBe(before);
        expect(new Marked().parse(markdown)).toBe(before);
        expect(before).not.toContain('<strong>');
    });
});
