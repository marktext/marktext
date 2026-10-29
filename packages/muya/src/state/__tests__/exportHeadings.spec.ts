// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { MarkdownToHtml } from '../markdownToHtml';

describe('export heading metadata', () => {
    it('reports the final IDs, levels and inline content from the rendered document', async () => {
        const markdown = [
            '<h2 id="intro">Reserved</h2>',
            '',
            '> ## Intro',
            '',
            '## Intro',
            '',
            '### Use **bold** and [a link](https://example.com)',
        ].join('\n');
        const { html, headings } = await new MarkdownToHtml(markdown).generateWithHeadings();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const rendered = [...doc.querySelectorAll('article h2, article h3')];

        expect(headings.map(heading => heading.slug)).toEqual([
            'intro',
            'intro-1',
            'intro-2',
            'use-bold-and-a-link',
        ]);
        expect(headings).toEqual(rendered.map(heading => ({
            lvl: Number(heading.tagName.slice(1)),
            content: heading.textContent,
            contentHtml: heading.innerHTML,
            slug: heading.id,
        })));
        expect(document.querySelector('.mu-render-container')).toBeNull();
    });

    it('does not retain headings between renders of the same exporter', async () => {
        const exporter = new MarkdownToHtml('## Old');
        await exporter.generateWithHeadings();
        exporter.markdown = '## New';

        const { html, headings } = await exporter.generateWithHeadings();

        expect(headings.map(heading => heading.slug)).toEqual(['new']);
        expect(html).toContain('<h2 id="new">New</h2>');
        expect(html).not.toContain('<h2 id="old">');
    });
});
