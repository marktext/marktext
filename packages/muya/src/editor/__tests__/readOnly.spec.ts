// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import CodeBlock from '../../block/commonMark/codeBlock';
import Frontmatter from '../../block/extra/frontmatter';
import TableBodyCell from '../../block/gfm/table/cell';
import * as locales from '../../locales';
import { Muya } from '../../muya';

const editors: Muya[] = [];
function boot(markdown: string, readOnly = false) {
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, readOnly });
    muya.init({ focus: false });
    editors.push(muya);
    return muya;
}
afterEach(() => {
    for (const muya of editors.splice(0)) {
        muya.destroy();
        muya.domNode.remove();
    }
    vi.restoreAllMocks();
});

describe('reading mode', () => {
    it.each(Object.values(locales))('refreshes reading labels and clipboard feedback in $name', async (locale) => {
        const muya = boot('```js\nconst value = 1\n```', true);
        const markdown = muya.getMarkdown();
        muya.locale(locale);
        expect(muya.domNode.getAttribute('aria-label')).toBe(locale.resource['Read-only document']);
        const button = muya.domNode.querySelector<HTMLButtonElement>('.mu-code-copy')!;
        expect(button.getAttribute('aria-label')).toBe(locale.resource['Copy content']);
        muya.setOptions({ clipboardWriteText: async () => true });
        button.click();
        await vi.waitFor(() => expect(button.getAttribute('aria-label')).toBe(locale.resource.Copied));
        muya.setOptions({ clipboardWriteText: async () => false });
        button.click();
        await vi.waitFor(() => expect(button.getAttribute('aria-label')).toBe(locale.resource['Copy failed']));
        expect(muya.getMarkdown()).toBe(markdown);
        muya.setReadOnly(false);
        expect(muya.domNode.getAttribute('aria-label')).toBe(locale.resource.Document);
    });

    it('leaves diagram images and links to the diagram preview handler', () => {
        const muya = boot('Paragraph', true);
        const preview = vi.fn();
        const openLink = vi.fn();
        muya.on('preview-image', preview);
        muya.on('format-click', openLink);
        const diagram = document.createElement('div');
        diagram.className = 'mu-diagram-preview';
        diagram.innerHTML = '<a href="https://example.com"><img src="https://example.com/diagram.svg"></a>';
        muya.domNode.append(diagram);
        const activateDiagram = vi.fn();
        diagram.addEventListener('click', activateDiagram);
        diagram.querySelector('img')!.click();
        expect(activateDiagram).toHaveBeenCalledTimes(1);
        expect(preview).not.toHaveBeenCalled();
        expect(openLink).not.toHaveBeenCalled();
    });

    it('copies heading anchors without previewing decorative images or offering them as document images', () => {
        const muya = boot('# Heading', true);
        const preview = vi.fn();
        const copied = vi.fn();
        const context = vi.fn();
        muya.on('preview-image', preview);
        muya.on('heading-copy-link', copied);
        muya.on('reading-context-menu', context);
        const icon = muya.domNode.querySelector<HTMLImageElement>('.mu-copy-header-link img')!;
        icon.click();
        expect(copied).toHaveBeenCalledTimes(1);
        expect(preview).not.toHaveBeenCalled();
        icon.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
        expect(context.mock.calls[0]?.[0].image).toBeUndefined();
    });

    it('detaches reading events and cancels pending link activation on destroy', () => {
        const muya = boot('[link](https://example.com)', true);
        const link = muya.domNode.querySelector<HTMLElement>('[role="link"]')!;
        const openLink = vi.fn();
        muya.on('format-click', openLink);
        const root = muya.domNode;
        vi.useFakeTimers();
        try {
            link.click();
            expect(vi.getTimerCount()).toBe(1);
            muya.destroy();
            expect(vi.getTimerCount()).toBe(0);
            expect(muya.eventCenter.events).toHaveLength(0);
            // Reattachment exposes listeners that would otherwise be masked by the connected-node guard.
            document.body.append(root);
            link.click();
            expect(vi.getTimerCount()).toBe(0);
            expect(root.dispatchEvent(new Event('beforeinput', { bubbles: true, cancelable: true }))).toBe(true);
            expect(root.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))).toBe(true);
            vi.advanceTimersByTime(300);
            expect(openLink).not.toHaveBeenCalled();
        }
        finally {
            vi.useRealTimers();
        }
    });

    it('locks leaf nodes and rejects commands and direct mutations without changing history', () => {
        const muya = boot('**hello**\n\n- [ ] task', true);
        const before = muya.getState();
        const history = muya.getHistory();
        const change = vi.fn();
        muya.on('json-change', change);
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'replacement';
        muya.insertParagraph();
        muya.duplicate();
        muya.updateParagraph('heading 1');
        muya.undo();
        muya.redo();
        muya.flush();
        expect(muya.getState()).toEqual(before);
        expect(muya.getHistory()).toEqual(history);
        expect(change).not.toHaveBeenCalled();
        expect(muya.domNode.querySelector('[contenteditable="true"]')).toBeNull();
        expect(muya.domNode.querySelector('input[type="checkbox"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).toBe(false);
        muya.flush();
        expect(muya.getState()).toEqual(before);
    });

    it('rejects setting the same language on a locked indented block without promoting it', () => {
        const muya = boot('    const value = 1', true);
        const block = muya.editor.scrollPage!.firstChild;
        expect(block).toBeInstanceOf(CodeBlock);
        if (!(block instanceof CodeBlock))
            throw new Error('Expected code block');
        const state = muya.getState();
        const changed = vi.fn();
        muya.on('json-change', changed);
        const language = block.lang;
        block.lang = language;
        block.lang = 'js';
        expect(muya.getState()).toEqual(state);
        expect(block.meta.type).toBe('indented');
        expect(changed).not.toHaveBeenCalled();
    });

    it.each([
        ['code', '```js\nconst value = 1\n```'],
        ['frontmatter', '---\nkey: true\n---\n\nBody'],
    ])('initializes %s highlighting while locked without allowing same-language setter side effects', async (_, markdown) => {
        const muya = boot(markdown, true);
        await vi.waitFor(() => expect(muya.domNode.querySelectorAll('.mu-codeblock-content .token').length).toBeGreaterThan(0));
        const block = muya.editor.scrollPage!.firstChild;
        if (!(block instanceof CodeBlock || block instanceof Frontmatter))
            throw new Error('Expected language-bearing block');
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        await new Promise(resolve => setTimeout(resolve, 0));
        const state = muya.getState();
        const update = vi.spyOn(block.lastContentInDescendant()!, 'update');
        const language = block.lang;
        block.lang = language;
        block.lang = 'css';
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(update).not.toHaveBeenCalled();
        expect(muya.getState()).toEqual(state);
    });

    it('rejects same-value alignment setters while locked', () => {
        const muya = boot('| a |\n| :-: |\n| b |', true);
        const cell = muya.editor.scrollPage!.firstContentInDescendant()!.parent;
        expect(cell).toBeInstanceOf(TableBodyCell);
        if (!(cell instanceof TableBodyCell))
            throw new Error('Expected table cell');
        cell.domNode!.dataset.align = 'sentinel';
        const alignment = cell.align;
        cell.align = alignment;
        expect(cell.domNode!.dataset.align).toBe('sentinel');
    });

    it('allows host reloads while retaining the lock and permits editing again after unlocking', () => {
        const muya = boot('old', true);
        muya.replaceContent('new');
        expect(muya.getMarkdown()).toContain('new');
        expect(muya.domNode.querySelector('[contenteditable="true"]')).toBeNull();
        muya.setOptions({ readOnly: false });
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'edited';
        muya.flush();
        expect(muya.getMarkdown()).toContain('edited');
    });

    it('preserves pending edits and permits valid targets again after lock/unlock', () => {
        const muya = boot('original');
        const target = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'pending';
        muya.setReadOnly(true);
        expect(muya.getMarkdown()).toContain('pending');
        const history = muya.getHistory();
        muya.setReadOnly(false);
        expect(!muya.isReadOnly && muya.isBlockInDocument(target)).toBe(true);
        expect(muya.getHistory()).toEqual(history);
        muya.undo();
        expect(muya.getMarkdown()).toContain('original');
    });

    it.each(['muya', 'selection'] as const)('selects the whole reading document through %s without editing selection side effects', (entry) => {
        const muya = boot('| a | b |\n| --- | --- |\n| c | d |\n\nLast paragraph', true);
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const last = muya.editor.scrollPage!.lastContentInDescendant()!;
        const state = muya.getState();
        const history = muya.getHistory();
        const changed = vi.fn();
        muya.on('selection-change', changed);
        const setSelection = vi.spyOn(muya.editor.selection, 'setSelection');

        if (entry === 'muya')
            muya.selectAll();
        else
            muya.editor.selection.selectAll();

        const range = document.getSelection()!.getRangeAt(0);
        expect(range.startContainer).toBe(first.domNode);
        expect(range.startOffset).toBe(0);
        expect(range.endContainer).toBe(last.domNode);
        expect(range.endOffset).toBe(last.domNode!.childNodes.length);
        expect(muya.editor.selection.table.hasSelection).toBe(false);
        expect(setSelection).not.toHaveBeenCalled();
        expect(changed).not.toHaveBeenCalled();
        expect(muya.getState()).toEqual(state);
        expect(muya.getHistory()).toEqual(history);
    });

    it('copies Markdown through the existing clipboard pipeline while reading', () => {
        const muya = boot('**hello** and [link](https://example.com)', true);
        muya.selectAll();
        const copied = muya.editor.clipboard.getClipboardData();
        expect(copied.text.trim()).toBe('**hello** and [link](https://example.com)');
        expect(copied.html).not.toContain('https://example.com)</');
        expect(muya.getMarkdown()).toContain('**hello**');
    });
});
