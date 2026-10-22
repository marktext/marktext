// @vitest-environment happy-dom
import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canTurnInto, replaceBlockByLabel } from '../block/blockTransforms';
import { convertGithubAlert } from '../block/githubAlerts';
import { Muya } from '../muya';
import { githubAlertBlockType } from '../utils/githubAlerts';

const instances: Muya[] = [];
function boot(markdown: string, githubAlerts = true) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, githubAlerts });
    muya.init();
    instances.push(muya);
    return muya;
}
function first(muya: Muya): Content {
    return muya.editor.scrollPage!.firstContentInDescendant()!;
}
function enter(content: Content) {
    content.enterHandler(new KeyboardEvent('keydown', { key: 'Enter' }));
}
afterEach(() => {
    instances.splice(0).forEach(muya => muya.destroy());
    document.getSelection()?.removeAllRanges();
});

describe('gitHub Alert editing', () => {
    it.each(['application menu', 'front menu', 'quick insert', 'Enter'])('keeps unrelated blocks mounted through %s, undo and redo', (entry) => {
        const initial = entry === 'Enter' ? '> [!NOTE]' : entry === 'quick insert' ? '/note' : 'Body';
        const muya = boot(`${initial}\n\nUntouched **bold** paragraph.`);
        const page = muya.editor.scrollPage!;
        const sibling = page.lastChild!;
        const dom = sibling.domNode;
        const rebuild = vi.spyOn(page, 'updateState');
        const before = muya.getState();
        first(muya).setCursor(first(muya).text.length, first(muya).text.length, true);
        if (entry === 'Enter')
            enter(first(muya));
        else if (entry === 'application menu')
            muya.updateParagraph('github-alert NOTE');
        else if (entry === 'front menu')
            convertGithubAlert(page.firstChild as Parent, 'github-alert NOTE');
        else
            replaceBlockByLabel({ block: page.firstChild as Parent, muya, label: 'github-alert NOTE' });

        const after = muya.getState();
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        const unchanged = () => {
            expect(page.lastChild).toBe(sibling);
            expect(sibling.domNode).toBe(dom);
            expect(dom?.isConnected).toBe(true);
            expect(rebuild).not.toHaveBeenCalled();
            expect(muya.getState()).toEqual(page.map(block => (block as Parent).getState()));
        };
        unchanged();
        muya.undo();
        expect(muya.getState()).toEqual(before);
        unchanged();
        muya.redo();
        expect(muya.getState()).toEqual(after);
        unchanged();
    });

    it('keeps queued typing and later edits separate from the local conversion', () => {
        const muya = boot('Body\n\nUntouched');
        first(muya).setCursor(0, 0, true);
        first(muya).text = 'Earlier edit';
        first(muya).update();
        muya.updateParagraph('github-alert TIP');
        first(muya).text = 'Later edit';
        first(muya).update();
        muya.flush();
        muya.undo();
        expect(muya.getMarkdown()).toContain('> Earlier edit');
        muya.undo();
        expect(muya.getMarkdown()).toBe('Earlier edit\n\nUntouched\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe('Body\n\nUntouched\n');
    });

    it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('creates %s and preserves the original inline markdown', (type) => {
        const muya = boot('**Body** [link](https://example.com)');
        first(muya).setCursor(2, 2, true);
        muya.updateParagraph(`github-alert ${type}`);
        expect(githubAlertBlockType(muya.editor.scrollPage!.firstChild as Parent)).toBe(type);
        expect(muya.getMarkdown()).toBe(`> [!${type}]\n> **Body** [link](https://example.com)\n`);
        expect(first(muya).text).toBe('**Body** [link](https://example.com)');
        expect(muya.domNode.querySelector('.mu-alert-title')?.textContent).toBe(type[0] + type.slice(1).toLowerCase());
    });

    it('changes types, unwraps complex body blocks and undoes each conversion', () => {
        const muya = boot('> [!NOTE]\n> Body\n>\n> - item\n>\n> ```js\n> code\n> ```');
        first(muya).setCursor(1, 1, true);
        muya.updateParagraph('github-alert WARNING');
        expect(muya.getMarkdown()).toContain('[!WARNING]');
        muya.updateParagraph('paragraph');
        expect(muya.getState().map(state => state.name)).toEqual(['paragraph', 'bullet-list', 'code-block']);
        expect(muya.getMarkdown()).not.toContain('[!');
        muya.undo();
        expect(muya.getMarkdown()).toContain('[!WARNING]');
        muya.undo();
        expect(muya.getMarkdown()).toContain('[!NOTE]');
    });

    it.each([
        '> [!NoTe]\n> Body',
        '> [!NOTE]\n>\n> Body',
        '> [!NOTE]\n> ```js\n> code\n> ```',
        '> [!NOTE]\n> - item',
        '> [!NOTE]\n> > nested',
    ])('preserves the body when reparsing after setting changes: %s', (markdown) => {
        const muya = boot(markdown);
        const initial = muya.getState()[0];
        if (initial.name !== 'github-alert')
            throw new Error('Expected an alert');
        muya.setOptions({ githubAlerts: false }, true);
        expect(muya.getState()[0].name).toBe('block-quote');
        expect(muya.domNode.querySelector('.mu-github-alert')).toBeNull();
        expect(muya.getMarkdown().startsWith(`${markdown.split('\n')[0]}\n`)).toBe(true);
        muya.setOptions({ githubAlerts: true }, true);
        expect(muya.getState()[0]).toMatchObject({ name: 'github-alert', children: initial.children });
        expect(muya.domNode.querySelector('.mu-github-alert')).not.toBeNull();
    });

    it.each(['2. Body', '2. [ ] Body'])('preserves a first list starting above one through conversion and serialization: %s', (body) => {
        const muya = boot(`> ${body}`);
        first(muya).setCursor(0, 0, true);
        muya.updateParagraph('github-alert NOTE');
        const state = muya.getState()[0];
        expect(state.name).toBe('github-alert');
        if (state.name !== 'github-alert')
            throw new Error('Expected an alert');
        expect(muya.editor.jsonState.markdownToState(muya.getMarkdown())[0]).toMatchObject({ children: state.children });
        muya.updateParagraph('github-alert WARNING');
        expect(muya.editor.jsonState.markdownToState(muya.getMarkdown())[0]).toMatchObject({ children: state.children });
    });

    it('toggles rendering without changing source', () => {
        const muya = boot('Body');
        first(muya).setCursor(2, 2, true);
        muya.updateParagraph('github-alert TIP');
        const markdown = muya.getMarkdown();
        muya.setOptions({ githubAlerts: false }, true);
        expect(muya.getMarkdown()).toBe(markdown);
        expect(muya.domNode.querySelector('.mu-github-alert')).toBeNull();
        muya.setOptions({ githubAlerts: true }, true);
        expect(muya.domNode.querySelector('.mu-github-alert')).not.toBeNull();
    });

    it.each(['NOTE', 'TIP', 'IMPORTANT', 'WARNING', 'CAUTION'])('upgrades [%s] on Enter, then exits an empty draft without stranding a marker', (type) => {
        const muya = boot(`> [!${type}]`);
        const marker = first(muya);
        marker.setCursor(marker.text.length, marker.text.length, true);
        enter(marker);
        muya.flush();
        expect(muya.domNode.querySelector('.mu-github-alert')).not.toBeNull();
        expect(first(muya).text).toBe('');
        enter(first(muya));
        muya.flush();
        expect(muya.getMarkdown()).not.toContain('[!');
        expect(muya.getState()[0].name).toBe('paragraph');
    });

    it.each([
        { name: 'Shift+Enter', offset: 7, end: 7, event: { shiftKey: true } },
        { name: 'IME composition', offset: 7, end: 7, event: { isComposing: true } },
        { name: 'a caret inside the marker', offset: 3, end: 3, event: {} },
        { name: 'a selected marker', offset: 0, end: 7, event: {} },
    ])('keeps the quote during $name', ({ offset, end, event }) => {
        const muya = boot('> [!NOTE]');
        const content = first(muya);
        content.setCursor(offset, end, true);
        content.enterHandler(new KeyboardEvent('keydown', { key: 'Enter', ...event }));
        muya.flush();
        expect(muya.getState()[0].name).toBe('block-quote');
        expect(muya.domNode.querySelector('.mu-github-alert')).toBeNull();
    });

    it.each(['block-quote', 'github-alert'] as const)('exits an empty middle paragraph without removing its %s siblings', (name) => {
        const muya = boot('');
        const children = Array.from({ length: 3 }, () => ({ name: 'paragraph' as const, text: '' }));
        muya.setContent(name === 'github-alert'
            ? [{ name, meta: { type: 'NOTE' }, children }]
            : [{ name, children }]);
        const container = muya.editor.scrollPage!.firstChild as Parent;
        const content = (container.find(1) as Parent).firstContentInDescendant()!;
        content.setCursor(0, 0, true);
        enter(content);
        muya.flush();
        expect(muya.getState()).toMatchObject([
            { name, children: [{ name: 'paragraph', text: '' }] },
            { name: 'paragraph', text: '' },
            { name, children: [{ name: 'paragraph', text: '' }] },
        ]);
        expect(muya.editor.selection.getSelection()?.anchor.path).toEqual([1, 'text']);
    });

    it('downgrades to a quote on Backspace and preserves the body', () => {
        const muya = boot('> [!NOTE]\n> Body');
        const body = first(muya);
        body.setCursor(0, 0, true);
        body.backspaceHandler(new KeyboardEvent('keydown', { key: 'Backspace' }));
        expect(muya.getMarkdown()).toBe('> Body\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe('> [!NOTE]\n> Body\n');
    });

    it('copies the complete body as portable markdown but leaves a local selection local', () => {
        const muya = boot('> [!NOTE]\n> Body');
        const body = first(muya);
        body.setCursor(0, body.text.length, true);
        expect(muya.editor.clipboard.getClipboardData().text).toBe('> [!NOTE]\n> Body\n');
        body.setCursor(1, 3, true);
        expect(muya.editor.clipboard.getClipboardData().text).toBe('od');
    });

    it('copies an alert whose complete body is a code block without selecting its language input', () => {
        const muya = boot('> [!NOTE]\n> ```js\n> code\n> ```');
        const code = muya.editor.scrollPage!.lastContentInDescendant()!;
        code.setCursor(0, code.text.length, true);
        expect(muya.editor.clipboard.getClipboardData().text).toBe(muya.getMarkdown());
    });

    it.each(['blockquote', 'ul-bullet'])('keeps alerts as ordinary quotes when wrapped inside %s', (command) => {
        const muya = boot('Before\n\n> [!NOTE]\n> Body');
        const page = muya.editor.scrollPage!;
        const anchor = page.firstContentInDescendant()!;
        const focus = page.lastContentInDescendant()!;
        muya.editor.selection.setSelection(
            { block: anchor, path: anchor.path, offset: 0 },
            { block: focus, path: focus.path, offset: focus.text.length },
        );
        muya.updateParagraph(command);
        muya.flush();
        expect(muya.domNode.querySelector('.mu-github-alert')).toBeNull();
        expect(muya.getMarkdown()).toContain('[!NOTE]');
        expect(muya.getMarkdown()).toContain('Body');
    });

    it('cuts a partial multi-paragraph body and restores it with undo and redo', () => {
        const muya = boot('> [!NOTE]\n> Alpha\n>\n> Beta\n>\n> Gamma');
        const before = muya.getMarkdown();
        const anchor = muya.editor.scrollPage!.firstContentInDescendant()!;
        const focus = muya.editor.scrollPage!.lastContentInDescendant()!;
        muya.editor.selection.setSelection(
            { block: anchor, path: anchor.path, offset: 2 },
            { block: focus, path: focus.path, offset: 2 },
        );
        muya.editor.clipboard.cutHandler();
        muya.flush();
        expect(muya.getState()[0].name).toBe('github-alert');
        expect(first(muya).text).toBe('Almma');
        const after = muya.getMarkdown();
        muya.undo();
        expect(muya.getMarkdown()).toBe(before);
        muya.redo();
        expect(muya.getMarkdown()).toBe(after);
    });

    it('keeps nested markers literal and hides their creation entries', () => {
        const muya = boot('- item\n\n  > [!NOTE]\n  > Body');
        const list = muya.editor.scrollPage!.firstChild as Parent;
        expect(muya.domNode.querySelector('.mu-github-alert')).toBeNull();
        expect(canTurnInto(list, 'github-alert NOTE')).toBe(false);
    });

    it('does not record a no-op type selection', () => {
        const muya = boot('> [!NOTE]\n> Body');
        first(muya).setCursor(1, 1, true);
        const history = muya.getHistory();
        muya.updateParagraph('github-alert NOTE');
        expect(muya.getHistory().stack.undo).toEqual(history.stack.undo);
    });
    it('preserves a range inside nested body content when changing type and unwrapping', () => {
        const muya = boot('> [!NOTE]\n> Body\n>\n> - first\n> - second');
        const content = muya.editor.scrollPage!.lastContentInDescendant()!;
        content.setCursor(1, 4, true);
        muya.updateParagraph('github-alert TIP');
        let selection = muya.editor.selection.getSelection()!;
        expect(selection.anchor.block.text).toBe('second');
        expect([selection.anchor.offset, selection.focus.offset]).toEqual([1, 4]);
        muya.updateParagraph('paragraph');
        selection = muya.editor.selection.getSelection()!;
        expect(selection.anchor.block.text).toBe('second');
        expect([selection.anchor.offset, selection.focus.offset]).toEqual([1, 4]);
    });

    it('retains the ordinary cross-paragraph quote command when alerts are enabled', () => {
        const muya = boot('Alpha\n\nBeta');
        const page = muya.editor.scrollPage!;
        const anchor = page.firstContentInDescendant()!;
        const focus = page.lastContentInDescendant()!;
        muya.editor.selection.setSelection(
            { block: anchor, path: anchor.path, offset: 0 },
            { block: focus, path: focus.path, offset: focus.text.length },
        );
        muya.updateParagraph('blockquote');
        muya.flush();
        expect(muya.getState()).toMatchObject([{ name: 'block-quote', children: [{ text: 'Alpha' }, { text: 'Beta' }] }]);
    });

    it('copies a partial multi-paragraph body without joining paragraphs or inventing a type', () => {
        const muya = boot('> [!NOTE]\n> Alpha\n>\n> Beta\n>\n> Gamma');
        const page = muya.editor.scrollPage!;
        const anchor = page.firstContentInDescendant()!;
        const focus = page.lastContentInDescendant()!;
        muya.editor.selection.setSelection(
            { block: anchor, path: anchor.path, offset: 2 },
            { block: focus, path: focus.path, offset: 2 },
        );
        expect(muya.editor.clipboard.getClipboardData().text).toBe('pha\n\nBeta\n\nGa\n');
    });
    it('keeps a reference link named !NOTE as body content when converting a quote', () => {
        const muya = boot('> [!NOTE]\n> Body\n\n[!NOTE]: https://example.com');
        const quote = muya.editor.scrollPage!.firstChild as Parent;
        expect(githubAlertBlockType(quote)).toBeNull();
        first(muya).setCursor(0, 0, true);
        muya.updateParagraph('github-alert WARNING');
        expect(muya.getMarkdown()).toContain('> [!NOTE]\n> Body');
        expect(muya.getMarkdown()).toContain('> [!WARNING]');
    });

    it.each([
        { name: 'fenced code', markdown: '```js\nalpha\nbeta\n```', text: 'alpha\nbeta' },
        { name: 'indented code', markdown: '    Body', text: 'Body' },
        { name: 'quote', markdown: '> Body', text: 'Body' },
        { name: 'bullet list', markdown: '- Body', text: 'Body' },
        { name: 'ordered list', markdown: '1. Body', text: 'Body' },
        { name: 'task list', markdown: '- [ ] Body', text: 'Body' },
        { name: 'ATX heading', markdown: '## Body', text: 'Body' },
        { name: 'setext heading', markdown: 'Body\n---', text: 'Body' },
    ])('unwraps the inner $name before downgrading the alert', ({ markdown, text }) => {
        const muya = boot(`> [!NOTE]\n>\n${markdown.split('\n').map(line => `> ${line}`).join('\n')}\n>\n> Tail\n\nOutside`);
        const before = muya.getState();
        const quote = muya.editor.scrollPage!.firstChild as Parent;
        let content = (quote.find(0) as Parent).firstContentInDescendant()!;
        if (content.blockName === 'language-input')
            content = content.nextContentInContext()!;
        content.setCursor(0, 0, true);
        content.keydownHandler(new KeyboardEvent('keydown', { key: 'Backspace' }));
        muya.flush();
        expect(githubAlertBlockType(quote)).toBe('NOTE');
        expect(muya.getState()).toMatchObject([
            { name: 'github-alert', children: [{ name: 'paragraph', text }, { text: 'Tail' }] },
            { name: 'paragraph', text: 'Outside' },
        ]);
        const after = muya.getState();
        expect(muya.editor.selection.getSelection()?.anchor.offset).toBe(0);
        muya.undo();
        expect(muya.getState()).toEqual(before);
        muya.redo();
        expect(muya.getState()).toEqual(after);
        const paragraph = first(muya);
        paragraph.setCursor(0, 0, true);
        paragraph.keydownHandler(new KeyboardEvent('keydown', { key: 'Backspace' }));
        muya.flush();
        expect(muya.getMarkdown()).not.toContain('[!NOTE]');
        expect(muya.getMarkdown()).toContain('Tail');
        expect(muya.getMarkdown()).toContain('Outside');
        muya.undo();
        expect(muya.getState()).toEqual(after);
    });
});
