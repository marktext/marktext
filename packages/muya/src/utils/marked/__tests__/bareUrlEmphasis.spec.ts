// @vitest-environment happy-dom

import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';
import inlineEmphasisExtension from '../extensions/inlineEmphasis';
import { getClipBoardHtml } from '../getClipboardHtml';
import { getHighlightHtml } from '../getHighlightHtml';

const URL = 'https://example.com/path';
const LINK = `<a href="${URL}">${URL}</a>`;

const CASES = [
    [`**${URL}**text`, `<strong>${LINK}</strong>text`],
    [`*${URL}*text`, `<em>${LINK}</em>text`],
    [`~~${URL}~~text`, `<del>${LINK}</del>text`],
    [`**${URL}**text*em*`, `<strong>${LINK}</strong>text<em>em</em>`],
    [`**${URL}**text\\*a*`, `<strong>${LINK}</strong>text*a*`],
    [`**${URL}**text\`*a*\``, `<strong>${LINK}</strong>text<code>*a*</code>`],
    [`**${URL}**text[a *b*](/next)`, `<strong>${LINK}</strong>text<a href="/next">a <em>b</em></a>`],
    [`**${URL}**&#x61;`, `<strong>${LINK}</strong>a`],
    [`**${URL}***em*`, `<strong>${LINK}</strong><em>em</em>`],
    [`**${URL}**https://other.example/a*b*c`, `<strong>${LINK}</strong><a href="https://other.example/a*b*c">https://other.example/a*b*c</a>`],
    ['**www.example.com/path**text', '<strong><a href="http://www.example.com/path">www.example.com/path</a></strong>text'],
    ['**foo@example.com**text', '<strong><a href="mailto:foo@example.com">foo@example.com</a></strong>text'],
    ['**https://example.com/a*b*c**text', '<strong><a href="https://example.com/a*b*c">https://example.com/a*b*c</a></strong>text'],
    ['https://example.com/a*b*c', '<a href="https://example.com/a*b*c">https://example.com/a*b*c</a>'],
    ['https://example.com/a**b**c', '<a href="https://example.com/a**b**c">https://example.com/a**b**c</a>'],
    [`a*${URL}**text`, `a*<a href="${URL}**text">${URL}**text</a>`],
    [`*${URL}**text`, `*<a href="${URL}**text">${URL}**text</a>`],
    ['**https://example.com/a`b**text`', '**<a href="https://example.com/a%60b**text%60">https://example.com/a`b**text`</a>'],
    ['**https://example.com/a\\**text', '**<a href="https://example.com/a%5C**text">https://example.com/a\\**text</a>'],
    ['**https://example.com/a\\*b*c**text', '<strong><a href="https://example.com/a%5C*b*c">https://example.com/a\\*b*c</a></strong>text'],
    ['prefix * unmatched https://example.com/a*b*c', 'prefix * unmatched <a href="https://example.com/a*b*c">https://example.com/a*b*c</a>'],
    ['**<https://example.com/path**text>', '**<a href="https://example.com/path**text">https://example.com/path**text</a>'],
    ['**[link](https://example.com/path**text)', '**<a href="https://example.com/path**text">link</a>'],
    ['**`https://example.com/path**text`', '**<code>https://example.com/path**text</code>'],
    [`[**${URL}**text](/outer)`, `<a href="/outer"><strong>${URL}</strong>text</a>`],
    [`<a href="/outer">**${URL}**text</a>`, `<a href="/outer"><strong>${URL}</strong>text</a>`],
] as const;

describe('emphasis precedence over bare URL autolinking', () => {
    for (const [name, render] of [['clipboard', getClipBoardHtml], ['export', getHighlightHtml]] as const) {
        it.each(CASES)(`${name}: %s`, (markdown, html) => {
            expect(render(markdown, { superSubScript: false })).toBe(`<p>${html}</p>\n`);
        });

        it(`${name}: repairs URLs in independently parsed alert bodies`, () => {
            const root = document.createElement('div');
            root.innerHTML = render(`> [!NOTE]\n> **${URL}**text`, { githubAlerts: true });
            expect(root.querySelector('.markdown-alert-note strong a')?.getAttribute('href')).toBe(URL);
            expect(root.querySelector('.markdown-alert-note')?.textContent).toContain(`${URL}text`);
        });

        it(`${name}: repairs URLs in footnote bodies`, () => {
            const root = document.createElement('div');
            root.innerHTML = render(`reference[^r]\n\n[^r]: **${URL}**text`, { footnote: true });
            expect(root.querySelector('.footnote-block strong a')?.getAttribute('href')).toBe(URL);
        });
    }

    it('keeps bare URLs as text when the GFM extension is disabled', () => {
        const marked = new Marked(inlineEmphasisExtension(), { gfm: false });
        expect(marked.parse(`**${URL}**text`)).toBe(`<p><strong>${URL}</strong>text</p>\n`);
    });
});
