// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { GITHUB_ALERT_TYPES } from '../../utils/githubAlerts';
import { getClipBoardHtml } from '../../utils/marked';
import HtmlToMarkdown from '../htmlToMarkdown';
import { MarkdownToState } from '../markdownToState';
import { renderToStaticHTML } from '../renderToStaticHTML';
import StateToMarkdown from '../stateToMarkdown';

const cases = [
    {
        name: 'tip',
        markdown: '> [!TIP]\n> Body',
        count: 1,
    },
    {
        name: 'important',
        markdown: '> [!IMPORTANT]\n> Body',
        count: 1,
    },
    {
        name: 'warning',
        markdown: '> [!WARNING]\n> Body',
        count: 1,
    },
    {
        name: 'caution',
        markdown: '> [!CAUTION]\n> Body',
        count: 1,
    },
    {
        name: 'mixed_case',
        markdown: '> [!NoTe]\n> Body',
        count: 1,
    },
    {
        name: 'trailing_spaces',
        markdown: '> [!NOTE]  \n> Body',
        count: 1,
    },
    {
        name: 'leading_marker_spaces',
        markdown: '>   [!NOTE]\n> Body',
        count: 1,
    },
    {
        name: 'no_quote_space',
        markdown: '>[!NOTE]\n>Body',
        count: 1,
    },
    {
        name: 'indent3',
        markdown: '   > [!NOTE]\n   > Body',
        count: 1,
    },
    {
        name: 'indent4',
        markdown: '    > [!NOTE]\n    > Body',
        count: 0,
    },
    {
        name: 'marker_only_newline',
        markdown: '> [!NOTE]\n>',
        count: 0,
    },
    {
        name: 'blank_before_body',
        markdown: '> [!NOTE]\n>\n> Body',
        count: 1,
    },
    {
        name: 'heading_body',
        markdown: '> [!NOTE]\n> # Heading',
        count: 1,
    },
    {
        name: 'list_body',
        markdown: '> [!NOTE]\n> - item',
        count: 1,
    },
    {
        name: 'multiple_body_blocks',
        markdown: '> [!NOTE]\n> Body\n>\n> More\n>\n> - item',
        count: 1,
    },
    {
        name: 'leading_blank',
        markdown: '>\n> [!NOTE]\n> Body',
        count: 1,
    },
    {
        name: 'marker_after_body',
        markdown: '> Earlier\n> [!NOTE]\n> Body',
        count: 0,
    },
    {
        name: 'marker_second_paragraph',
        markdown: '> Earlier\n>\n> [!NOTE]\n> Body',
        count: 0,
    },
    {
        name: 'escaped_marker',
        markdown: '> \\[!NOTE]\n> Body',
        count: 1,
    },
    {
        name: 'inline_code_marker',
        markdown: '> `[!NOTE]`\n> Body',
        count: 0,
    },
    {
        name: 'nested_quote',
        markdown: '> > [!NOTE]\n> > Body',
        count: 0,
    },
    {
        name: 'nested_list',
        markdown: '- item\n\n  > [!NOTE]\n  > Body',
        count: 0,
    },
    {
        name: 'nested_details',
        markdown: '<details>\n<summary>Details</summary>\n\n> [!NOTE]\n> Body\n\n</details>',
        count: 0,
    },
    {
        name: 'adjacent_separated',
        markdown: '> [!NOTE]\n> One\n\n> [!TIP]\n> Two',
        count: 2,
    },
    {
        name: 'adjacent_unseparated',
        markdown: '> [!NOTE]\n> One\n> [!TIP]\n> Two',
        count: 1,
    },
    {
        name: 'lazy_body',
        markdown: '> [!NOTE]\nBody',
        count: 1,
    },
    {
        name: 'outer_alert_inner_alert',
        markdown: '> [!NOTE]\n> Body\n>\n> > [!TIP]\n> > Inner',
        count: 1,
    },
    {
        name: 'foldable',
        markdown: '> [!NOTE]+\n> Body',
        count: 0,
    },
    {
        name: 'bold_marker',
        markdown: '> **[!NOTE]**\n> Body',
        count: 0,
    },
    {
        name: 'inline_link_marker',
        markdown: '> [!NOTE](https://example.com)\n> Body',
        count: 0,
    },
];

describe('gitHub Alerts compatibility', () => {
    it.each(GITHUB_ALERT_TYPES)('preserves %s markers followed by inline content on the same line', (type) => {
        for (const body of [
            '**body**',
            '*body*',
            '[body](https://example.com)',
            '![body](image.png)',
            '`body`',
            '<span>body</span>',
            '<br>body',
            '<br>\n> body',
            '**body**\n> next',
            '<span></span>\n> body',
            '\\\n> **body**',
        ]) {
            const markdown = `> [!${type}]${body}`;
            for (const render of [renderToStaticHTML, getClipBoardHtml]) {
                const actual = document.createElement('div');
                const expected = document.createElement('div');
                actual.innerHTML = render(markdown, { githubAlerts: true });
                expected.innerHTML = render(markdown, { githubAlerts: false });
                expect(actual.querySelector('.markdown-alert')).toBeNull();
                expect(actual.querySelector('blockquote')?.textContent).toContain(`[!${type}]`);
                expect(actual.innerHTML).toBe(expected.innerHTML);
                expect(actual.innerHTML).not.toContain('mu-non-alert-quote');
            }
        }
    });

    it.each(['\n', '  \n'])('recognizes a marker followed by inline content after a %j line break', (lineBreak) => {
        const markdown = `> [!NOTE]${lineBreak}> **body**`;
        for (const render of [renderToStaticHTML, getClipBoardHtml]) {
            const root = document.createElement('div');
            root.innerHTML = render(markdown, { githubAlerts: true });
            expect(root.querySelector('.markdown-alert-note strong')?.textContent, root.innerHTML).toBe('body');
            expect(root.textContent).not.toContain('[!NOTE]');
        }
    });

    it.each(cases)('$name matches the GitHub rendering baseline', ({ markdown, count }) => {
        for (const render of [renderToStaticHTML, getClipBoardHtml]) {
            const root = document.createElement('div');
            root.innerHTML = render(markdown, { githubAlerts: true });
            expect(root.querySelectorAll('.markdown-alert')).toHaveLength(count);
        }
        expect(new MarkdownToState({ githubAlerts: true }).generate(markdown).filter(state => state.name === 'github-alert')).toHaveLength(count);
    });

    it.each(cases)('$name remains ordinary markdown by default and survives state serialization', ({ markdown }) => {
        const before = renderToStaticHTML(markdown);
        const state = new MarkdownToState().generate(markdown);
        const serialized = new StateToMarkdown().generate(state);
        const root = document.createElement('div');
        root.innerHTML = before;
        expect(root.querySelector('.markdown-alert')).toBeNull();
        expect(renderToStaticHTML(serialized).trim()).toBe(before.trim());
    });

    it('does not lose a marker-only quote when rendering is enabled', () => {
        expect(renderToStaticHTML('> [!NOTE]', { githubAlerts: true })).toContain('[!NOTE]');
    });

    it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('restores %s from GitHub / exported HTML without copying its title', (type) => {
        const markdown = `> [!${type}]\n> **Body**\n>\n> - item`;
        const html = renderToStaticHTML(markdown, { githubAlerts: true });
        const restored = new HtmlToMarkdown().generate(html);
        const root = document.createElement('div');
        root.innerHTML = renderToStaticHTML(restored, { githubAlerts: true });
        expect(root.querySelector(`.markdown-alert-${type.toLowerCase()}`)).not.toBeNull();
        expect(root.querySelectorAll('.markdown-alert-title')).toHaveLength(1);
        expect(root.querySelector('strong')?.textContent).toBe('Body');
        expect(root.querySelector('li')?.textContent).toBe('item');
    });

    it('does not interpret a GitLab fenced quote as an alert', () => {
        const html = renderToStaticHTML('>>>\n[!NOTE]\nBody\n>>>', { githubAlerts: true, multilineBlockquote: true });
        expect(html).not.toContain('markdown-alert');
        expect(html).toContain('[!NOTE]');
    });

    it('keeps sanitizing untrusted body HTML and URLs', () => {
        const html = renderToStaticHTML('> [!NOTE]\n> <img src="x" onerror="alert(1)"> [bad](javascript:alert(1))', { githubAlerts: true });
        expect(html).toContain('markdown-alert-note');
        expect(html).not.toMatch(/onerror|javascript:/);
    });
});
