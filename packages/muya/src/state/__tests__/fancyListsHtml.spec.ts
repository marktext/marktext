// @vitest-environment jsdom

import { execFileSync, spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { getSanitizeClipboardHtml } from '../../utils/marked/getClipboardHtml';
import { renderToStaticHTML } from '../renderToStaticHTML';

const OUTLINE = 'I.  Introduction\n    A.  Background\n        1. Early work\n';

const OUTLINE_HTML = [
    '<ol type="I" class="fancy-list-upper-roman">',
    '<li>Introduction<ol type="A" class="fancy-list-upper-alpha">',
    '<li>Background<ol type="1" class="fancy-list-decimal">',
    '<li>Early work</li>',
    '</ol>',
    '</li>',
    '</ol>',
    '</li>',
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
            '<ol type="1" start="3" class="fancy-list-decimal-paren">',
            '<li>three</li>',
            '<li>four</li>',
            '</ol>',
            '<ol type="I" start="4" class="fancy-list-upper-roman">',
            '<li>four</li>',
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
