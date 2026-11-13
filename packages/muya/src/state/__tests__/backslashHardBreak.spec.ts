// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { tokenizer } from '../../inline/lexer';
import { getClipBoardHtml, getHighlightHtml } from '../../utils/marked';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

describe('backslash hard break persistence and HTML (#5967)', () => {
    it.each([
        'foo\\\nbaz',
        '*foo\\\nbar*',
        '[foo\\\nbar](/url)',
        '- foo\\\n  baz',
        '> foo\\\n> baz',
    ])('preserves the backslash spelling when saving %j', (markdown) => {
        const importer = new MarkdownToState();
        const state = importer.generate(markdown);
        const saved = new ExportMarkdown().generate(state);
        expect(saved.trimEnd()).toBe(markdown);
        expect(importer.generate(saved)).toEqual(state);
    });

    it.each(['foo\\\n', 'foo\\\n\nbar', '### foo\\\n'])('does not turn a block ending into a hard break: %j', (markdown) => {
        const state = new MarkdownToState().generate(markdown);
        for (const block of state) {
            if ('text' in block)
                expect(tokenizer(block.text).map(token => token.type)).not.toContain('hard_line_break');
        }
    });

    for (const [name, render] of [['export', getHighlightHtml], ['clipboard', getClipBoardHtml]] as const) {
        it(`${name} renders a backslash hard break as br`, () => {
            const container = document.createElement('div');
            container.innerHTML = render('foo\\\nbaz');
            expect(container.querySelectorAll('p > br')).toHaveLength(1);
            expect(container.textContent).not.toContain('\\');
        });

        it(`${name} keeps a terminal backslash literal`, () => {
            const container = document.createElement('div');
            container.innerHTML = render('foo\\\n');
            expect(container.querySelector('br')).toBeNull();
            expect(container.querySelector('p')?.textContent).toBe('foo\\');
        });
    }
});
