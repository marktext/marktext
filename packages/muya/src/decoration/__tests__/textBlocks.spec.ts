// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { markdownToTextBlocks, Muya } from '../../index';

// `getTextBlocks()` walks the live tree; `markdownToTextBlocks()` reparses
// markdown with no DOM. They have to agree on type and text, including blocks
// whose source line carries a container prefix the block text does not.

const FIXTURE = [
    'Alpha paragraph.',
    '',
    '# ATX heading',
    '',
    'Setext heading',
    '===============',
    '',
    '- outer',
    '  - inner',
    '',
    '- [ ] task item',
    '',
    '> quoted line',
    '',
    '| h1 | h2 |',
    '| --- | --- |',
    '| c1 | c2 |',
    '',
    '```',
    'const value = 1',
    '```',
    '',
    '---',
    '',
].join('\n');

const editors: Muya[] = [];
let originalVersion: string | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    document.getSelection()?.removeAllRanges();
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown });
    muya.init();
    editors.push(muya);
    return muya;
}

function contentByText(muya: Muya, text: string): Content {
    let result: Content | undefined;
    muya.editor.scrollPage!.breadthFirstTraverse((block) => {
        if (block.isContent() && block.text === text)
            result = block;
    });
    if (!result)
        throw new Error(`Content not found: ${text}`);
    return result;
}

describe('text blocks', () => {
    it('matches the headless parse on type and text', () => {
        const muya = boot(FIXTURE);
        const live = muya.getTextBlocks().map(({ type, text }) => ({ type, text }));
        const headless = markdownToTextBlocks(muya.getMarkdown()).map(({ type, text }) => ({ type, text }));

        expect(live).toEqual(headless);
        expect(live).toEqual(expect.arrayContaining([
            { type: 'paragraph', text: 'Alpha paragraph.' },
            { type: 'atxheading', text: '# ATX heading' },
            { type: 'setextheading', text: 'Setext heading' },
            { type: 'listitem', text: 'outer' },
            { type: 'listitem', text: 'inner' },
            { type: 'taskitem', text: 'task item' },
            { type: 'paragraph', text: 'quoted line' },
            { type: 'tablecell', text: 'h1' },
            { type: 'tablecell', text: 'c1' },
            { type: 'codeblock', text: 'const value = 1' },
            { type: 'thematic-break', text: '---' },
        ]));
        expect(live.some(block => block.text === 'js' || block.type === 'language-input')).toBe(false);
    });

    it('returns null for a caret, a language input, and a range across two blocks', () => {
        const muya = boot('First\n\n```js\nconst x = 1\n```\n\nSecond\n');

        expect(muya.getSelectionInBlock()).toBeNull();

        const first = contentByText(muya, 'First');
        first.setCursor(0, 0, true);
        expect(muya.getSelectionInBlock()).toBeNull();

        let lang: Content | undefined;
        muya.editor.scrollPage!.breadthFirstTraverse((block) => {
            if (block.isContent() && block.blockName === 'language-input')
                lang = block;
        });
        lang!.setCursor(0, 2, true);
        expect(muya.getSelectionInBlock()).toBeNull();

        const second = contentByText(muya, 'Second');
        muya.editor.selection.setSelection(
            { offset: 2, block: first, path: first.path },
            { offset: 3, block: second, path: second.path },
        );
        expect(muya.getSelectionInBlock()).toBeNull();
    });

    it('returns the block index and source slice for a range inside one block', () => {
        const muya = boot('- outer item\n\nSecond\n');
        const item = contentByText(muya, 'outer item');
        item.setCursor(6, 10, true);

        expect(muya.getSelectionInBlock()).toEqual({
            index: muya.getTextBlocks().findIndex(block => block.text === 'outer item'),
            start: 6,
            end: 10,
            text: 'item',
        });

        const second = contentByText(muya, 'Second');
        muya.editor.selection.setSelection(
            { offset: 6, block: second, path: second.path },
            { offset: 0, block: second, path: second.path },
        );
        expect(muya.getSelectionInBlock()).toEqual({
            index: muya.getTextBlocks().findIndex(block => block.text === 'Second'),
            start: 0,
            end: 6,
            text: 'Second',
        });
    });
});

describe('decorations', () => {
    it('survives a repaint of the same block and coexists with search', () => {
        const muya = boot('Hello world\n');
        muya.setDecorations([{ id: 'c1', blockIndex: 0, start: 4, end: 9, active: false }]);
        muya.search('world');

        const commentOnly = [...muya.domNode.querySelectorAll('.mu-comment')]
            .find(el => !el.classList.contains('mu-highlight') && !el.classList.contains('mu-selection'));
        const overlap = [...muya.domNode.querySelectorAll('.mu-comment')]
            .find(el => el.classList.contains('mu-highlight') || el.classList.contains('mu-selection'));

        expect(commentOnly?.textContent).toBe('o ');
        expect(overlap?.textContent).toBe('wor');
        expect(overlap?.getAttribute('data-comment-id')).toBe('c1');

        const block = contentByText(muya, 'Hello world');
        block.text = 'Hello world!';
        block.update();

        expect(muya.domNode.querySelector('[data-comment-id="c1"]')).not.toBeNull();
    });

    it('paints an active mark in a code block and scrolls to it', () => {
        const muya = boot('```\nconst value = 1\n```\n');
        const code = muya.getTextBlocks().find(block => block.type === 'codeblock');
        expect(code).toBeTruthy();
        const start = code!.text.indexOf('value');
        muya.setDecorations([{
            id: 'code',
            blockIndex: code!.index,
            start,
            end: start + 'value'.length,
            active: true,
        }]);

        const mark = muya.domNode.querySelector('.mu-codeblock-content .mu-comment');
        expect(mark?.textContent).toBe('value');
        expect(mark?.classList.contains('mu-comment-active')).toBe(true);

        const scroll = vi.spyOn(mark as Element, 'scrollIntoView').mockImplementation(() => {});
        muya.scrollToDecoration('code');
        expect(scroll).toHaveBeenCalled();
        expect(() => muya.scrollToDecoration('missing')).not.toThrow();
    });

    it('emits decoration-click with the comment id', () => {
        const muya = boot('Hello world\n');
        const clicks: string[] = [];
        muya.on('decoration-click', (payload: { id: string }) => {
            clicks.push(payload.id);
        });
        muya.setDecorations([{ id: 'c1', blockIndex: 0, start: 0, end: 5, active: true }]);

        const mark = muya.domNode.querySelector('.mu-comment');
        expect(mark).not.toBeNull();
        mark!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(clicks).toEqual(['c1']);
        expect(mark!.classList.contains('mu-comment-active')).toBe(true);
    });

    it('paints a draft mark with a dashed class and without the active class', () => {
        const muya = boot('Hello world\n');
        muya.setDecorations([{
            id: 'comment-draft',
            blockIndex: 0,
            start: 0,
            end: 5,
            active: true,
            draft: true,
        }]);

        const mark = muya.domNode.querySelector('.mu-comment');
        expect(mark).not.toBeNull();
        expect(mark!.classList.contains('mu-comment-draft')).toBe(true);
        expect(mark!.classList.contains('mu-comment-active')).toBe(false);
    });

    it('drops marks when the document is replaced', () => {
        const muya = boot('Hello world\n');
        muya.setDecorations([{ id: 'c1', blockIndex: 0, start: 0, end: 5, active: false }]);
        expect(muya.domNode.querySelector('.mu-comment')).not.toBeNull();

        muya.setContent('Hello world\n');

        expect(muya.domNode.querySelector('.mu-comment')).toBeNull();
    });
});
