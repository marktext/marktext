// @vitest-environment happy-dom

import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';
import inlineDelimitersExtension from '../extensions/inlineDelimiters';
import { getClipBoardHtml } from '../getClipboardHtml';
import { getHighlightHtml } from '../getHighlightHtml';
import fixtures from './fixtures/gfm-autolink-precedence.json';

const URL = 'https://example.com/path';

describe('gfm autolink precedence over emphasis', () => {
    for (const [name, render] of [['clipboard', getClipBoardHtml], ['export', getHighlightHtml]] as const) {
        // Expected HTML was generated with cmark-gfm (cmarkgfm 2025.10.22), GFM §6.9.
        it.each(fixtures)(`${name}: $markdown`, ({ markdown, html }) => {
            expect(render(markdown, { superSubScript: false })).toBe(html);
        });

        it(`${name}: retains GFM URL boundaries in independently parsed alert bodies`, () => {
            const root = document.createElement('div');
            root.innerHTML = render(`> [!NOTE]\n> **${URL}**text`, { githubAlerts: true });
            expect(root.querySelector('.markdown-alert-note a')?.getAttribute('href')).toBe(`${URL}**text`);
            expect(root.querySelector('.markdown-alert-note strong')).toBeNull();
            expect(root.querySelector('.markdown-alert-note')?.textContent).toContain(`**${URL}**text`);
        });

        it(`${name}: retains GFM URL boundaries in footnote bodies`, () => {
            const root = document.createElement('div');
            root.innerHTML = render(`reference[^r]\n\n[^r]: **${URL}**text`, { footnote: true });
            expect(root.querySelector('.footnote-block a')?.getAttribute('href')).toBe(`${URL}**text`);
        });
    }

    it('does not create nested autolinks inside an HTML anchor', () => {
        expect(getHighlightHtml(`<a href="/outer">**${URL}**text</a>`)).toBe(
            `<p><a href="/outer"><strong>${URL}</strong>text</a></p>\n`,
        );
    });

    it('keeps bare URLs as text when the GFM extension is disabled', () => {
        const marked = new Marked(inlineDelimitersExtension(), { gfm: false });
        expect(marked.parse(`**${URL}**text`)).toBe(`<p><strong>${URL}</strong>text</p>\n`);
    });
});
