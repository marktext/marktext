// @vitest-environment jsdom

import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getSanitizeClipboardHtml } from '../../utils/marked/getClipboardHtml';
import { renderToStaticHTML } from '../renderToStaticHTML';

const OUTLINE = 'I.  Introduction\n    A.  Background\n        1. Early work\n';

const OUTLINE_HTML = [
    '<ol type="I" class="fancy-list-upper-roman">',
    '<li>Introduction<ol type="A" class="fancy-list-upper-alpha"><li>Background<ol type="1" class="fancy-list-decimal"><li>Early work</li></ol></li></ol></li>',
    '</ol>',
    '',
].join('\n');

describe('fancy lists in exported HTML', () => {
    it('nests an outline as typed ordered lists', () => {
        expect(renderToStaticHTML(OUTLINE, { fancyLists: true })).toBe(OUTLINE_HTML);
    });

    it('names the delimiter in the class and keeps the start number', () => {
        const html = renderToStaticHTML('(a) one\n(b) two\n\n3) three\n4) four\n\nIV. four\n', { fancyLists: true });

        expect(html).toBe([
            '<ol type="a" class="fancy-list-lower-alpha-parens">',
            '<li>one</li>',
            '<li>two</li>',
            '</ol>',
            '<ol start="3" type="1" class="fancy-list-decimal-paren">',
            '<li>three</li>',
            '<li>four</li>',
            '</ol>',
            '<ol start="4" type="I" class="fancy-list-upper-roman">',
            '<li>four</li>',
            '</ol>',
            '',
        ].join('\n'));
    });

    it('numbers # lists as decimal ones', () => {
        expect(renderToStaticHTML('#. one\n#. two\n\n(#) three\n', { fancyLists: true })).toBe([
            '<ol type="1" class="fancy-list-decimal">',
            '<li>one</li>',
            '<li>two</li>',
            '</ol>',
            '<ol type="1" class="fancy-list-decimal-parens">',
            '<li>three</li>',
            '</ol>',
            '',
        ].join('\n'));
    });

    it('leaves lettered markers as text when the option is off', () => {
        expect(renderToStaticHTML(OUTLINE)).toBe('<p>I.  Introduction\n    A.  Background\n        1. Early work</p>\n');
        expect(renderToStaticHTML('3) three\n')).toBe('<ol start="3">\n<li>three</li>\n</ol>\n');
    });

    it('copies the same lists to the clipboard', () => {
        expect(getSanitizeClipboardHtml(OUTLINE, { fancyLists: true })).toBe(OUTLINE_HTML);
    });
});

describe.each([
    ['HTML export', (markdown: string) => renderToStaticHTML(markdown, { fancyLists: true })],
    ['clipboard HTML', (markdown: string) => getSanitizeClipboardHtml(markdown, { fancyLists: true })],
] as const)('fancy lists in %s', (_name, render) => {
    const bodyOf = (markdown: string) => new DOMParser().parseFromString(render(markdown), 'text/html').body;

    it('preserves distinct paragraphs inside one loose item', () => {
        const body = bodyOf('a. first\n\n   second\n\nb. third\n');
        expect([...body.querySelectorAll('ol > li > p')].map(p => p.textContent)).toEqual(['first', 'second', 'third']);
    });

    it('renders checked and unchecked tasks without leaving literal markers', () => {
        const body = bodyOf('(a) [ ] todo\n(b) [x] **done**\n(c) [X] upper\n');
        const boxes = [...body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
        expect(boxes.map(box => box.checked)).toEqual([false, true, true]);
        expect(boxes.every(box => box.disabled)).toBe(true);
        expect(body.querySelector('strong')?.textContent).toBe('done');
        expect(body.textContent).not.toMatch(/\[[ x]\]/i);
    });

    it('keeps paragraphs and inline markup in loose tasks', () => {
        const body = bodyOf('a. [ ] **first**\n\n   second\n\nb. [x] last\n');
        expect([...body.querySelectorAll('ol > li > p')].map(p => p.textContent?.trim())).toEqual(['first', 'second', 'last']);
        expect(body.querySelector('strong')?.textContent).toBe('first');
        expect([...body.querySelectorAll<HTMLInputElement>('input')].map(box => box.checked)).toEqual([false, true]);
    });

    it('renders tasks nested under another marker style', () => {
        const body = bodyOf('- parent\n  (a) [x] done\n  (b) next\n');
        expect(body.querySelector<HTMLInputElement>('ul > li > ol > li > input')?.checked).toBe(true);
        expect(body.querySelector('ol')?.getAttribute('type')).toBe('a');
    });

    it('keeps empty task items', () => {
        const body = bodyOf('(a) [ ]\n(b) [x]\n');
        expect([...body.querySelectorAll<HTMLInputElement>('input')].map(box => box.checked)).toEqual([false, true]);
    });

    it('removes formatting newlines from mixed nested lists while retaining soft breaks', () => {
        const body = bodyOf('1. parent\n   a. line A\n      line B\n      - child\n   b. next\n');
        const nested = body.querySelector('ol ol')!;
        expect(nested.innerHTML).toBe('<li>line A\nline B<ul><li>child</li></ul></li><li>next</li>');
    });
});

const HAS_PANDOC = spawnSync('pandoc', ['--version']).status === 0;

// Each ordered list as `type start: item texts`, in document order.
function orderedLists(html: string): string[] {
    const body = new DOMParser().parseFromString(html, 'text/html').body;

    return [...body.querySelectorAll('ol')].map((list) => {
        const items = [...list.children].map(item => item.firstChild?.textContent?.trim());

        return `${list.getAttribute('type')} ${list.getAttribute('start') ?? '1'}: ${items.join(', ')}`;
    });
}

describe.skipIf(!HAS_PANDOC)('fancy lists in exported HTML: pandoc renders the same lists', () => {
    it.each([
        OUTLINE,
        '(a) one\n(b) two\n',
        '3) three\n4) four\n',
        'ii. two\niii. three\n',
        'A.  Alpha\nB.  Beta\n\n    i. inner\n    ii. inner two\n',
    ])('%j', (markdown) => {
        const pandoc = execFileSync('pandoc', ['-f', 'markdown', '-t', 'html'], { input: markdown, encoding: 'utf8' });

        expect(orderedLists(renderToStaticHTML(markdown, { fancyLists: true }))).toEqual(orderedLists(pandoc));
    });
});
