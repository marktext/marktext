// @vitest-environment jsdom

// Regression for #4812: a single mermaid diagram with a syntax error must not
// abort the whole document export. The styled-HTML / PDF export path renders
// every `code.language-mermaid` via `mermaid.run`; a batch run rejects entirely
// on the first parse error, so one bad diagram threw all the way up to the
// desktop wrapper ("Failed to export document") and no file was written.
//
// `mermaid` can't run under jsdom, so we mock the diagram-renderer loader to
// return a fake mermaid whose `run` throws like the real parser does on invalid
// input. That isolates the behaviour under test — per-diagram error containment.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mermaidRun = vi.fn();

vi.mock('../../utils/diagram', () => ({
    default: vi.fn(async (name: string) => {
        if (name === 'mermaid') {
            return {
                initialize: vi.fn(),
                run: mermaidRun,
            };
        }
        throw new Error(`unexpected renderer ${name}`);
    }),
}));

// Import AFTER the mock is registered.
const { MarkdownToHtml } = await import('../markdownToHtml');

beforeEach(() => {
    mermaidRun.mockReset();
});

const INVALID_MERMAID = [
    '# Title',
    '',
    'Intro paragraph.',
    '',
    '```mermaid',
    'graph LR',
    'H[a|b|c]',
    '```',
    '',
    'Trailing paragraph.',
    '',
].join('\n');

describe('#4812: mermaid syntax error must not abort export', () => {
    it('renderHtml resolves even when a mermaid diagram fails to parse', async () => {
        // Real mermaid rejects on a parse error; emulate that.
        mermaidRun.mockRejectedValue(new Error('Parse error on line 2: ... got \'PIPE\''));

        const md2html = new MarkdownToHtml(INVALID_MERMAID);
        const html = await md2html.renderHtml();

        // The surrounding document still exports.
        expect(html).toContain('Title');
        expect(html).toContain('Intro paragraph.');
        expect(html).toContain('Trailing paragraph.');
        // The broken diagram degrades to the same placeholder the other
        // diagram renderers use, instead of throwing.
        expect(html).toContain('&lt; Invalid Diagram &gt;');
    });

    it('one broken diagram does not stop a later valid diagram from rendering', async () => {
        // First diagram throws, second succeeds. A batch run would abort both.
        mermaidRun
            .mockRejectedValueOnce(new Error('Parse error'))
            .mockResolvedValueOnce(undefined);

        const TWO = [
            '```mermaid',
            'graph LR',
            'H[a|b|c]',
            '```',
            '',
            '```mermaid',
            'graph TD; A-->B',
            '```',
            '',
        ].join('\n');

        const html = await new MarkdownToHtml(TWO).renderHtml();

        expect(mermaidRun).toHaveBeenCalledTimes(2);
        expect(html).toContain('&lt; Invalid Diagram &gt;');
    });
});
