// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Format from '../../block/base/format';
import { Muya } from '../../muya';
import { InlineFormatToolbar } from '../inlineFormatToolbar';
import { ParagraphFrontMenu } from '../paragraphFrontMenu';
import { ParagraphQuickInsertMenu } from '../paragraphQuickInsertMenu';

let muya: Muya;
const plugins: Array<{ destroy: () => void }> = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'audit' });
    muya.init();
});

afterEach(() => {
    for (const plugin of plugins.splice(0)) plugin.destroy();
    muya.destroy();
});

function press(key: string, code: string, modifiers: KeyboardEventInit) {
    muya.domNode.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true, cancelable: true, ...modifiers }));
}

describe('host-owned command shortcuts', () => {
    it('disables hidden format aliases while preserving toolbar clicks', async () => {
        const toolbar = new InlineFormatToolbar(muya, { keyboardShortcuts: false, getShortcut: () => 'F8' });
        plugins.push(toolbar);
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        if (!(block instanceof Format))
            throw new Error('Expected a format block');
        block.setCursor(0, 5, true);
        const format = vi.spyOn(block, 'format');
        press('e', 'KeyE', { ctrlKey: true, metaKey: true });
        expect(format).not.toHaveBeenCalled();
        toolbar.status = true;
        muya.refreshShortcutHints();
        const item = toolbar.container!.querySelector<HTMLElement>('.item.inline_code')!;
        expect(item.title).toBe('Inline Code\nF8');
        item.click();
        await vi.waitFor(() => expect(muya.getMarkdown()).toBe('`audit`\n'));
    });

    it('retains format shortcuts for standalone instances', () => {
        const toolbar = new InlineFormatToolbar(muya);
        plugins.push(toolbar);
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        if (!(block instanceof Format))
            throw new Error('Expected a format block');
        block.setCursor(0, 5, true);
        const format = vi.spyOn(block, 'format').mockImplementation(() => {});
        press('e', 'KeyE', { ctrlKey: true });
        expect(format).toHaveBeenCalledWith('inline_code');
    });

    it.each([true, false])('empty paragraph shortcut enabled=%s', async (enabled) => {
        muya.setContent('');
        const menu = new ParagraphQuickInsertMenu(muya, { keyboardShortcuts: enabled });
        plugins.push(menu);
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true);
        press('2', 'Digit2', { metaKey: true });
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe(enabled ? 'atx-heading' : 'paragraph'));
    });

    it('refreshes authoritative hints, clears unbound hints, and retains quick-menu selection', async () => {
        const hints: Record<string, string> = { strong: 'F8', table: 'F9', duplicate: 'F10' };
        const options = { getShortcut: (action: string) => hints[action] };
        const toolbar = new InlineFormatToolbar(muya, options);
        const quick = new ParagraphQuickInsertMenu(muya, options);
        const front = new ParagraphFrontMenu(muya, options);
        plugins.push(toolbar, quick, front);
        toolbar.status = true;
        quick.status = true;
        quick.activeItem = quick.renderArray.find(item => item.label === 'table')!;
        const activeItem = quick.activeItem;
        const content = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.eventCenter.emit('muya-front-menu', { reference: muya.domNode, block: content.parent });
        await vi.waitFor(() => expect(front.container!.querySelector('.duplicate .short-cut')?.textContent).toBe('F10'));
        muya.refreshShortcutHints();
        expect(toolbar.container!.querySelector<HTMLElement>('.strong')!.title).toBe('Emphasize\nF8');
        expect(toolbar.container!.querySelector<HTMLElement>('.inline_code')!.title).toBe('Inline Code');
        expect(quick.container!.querySelector('[data-label="table"] .short-cut')?.textContent).toBe('F9');
        expect(quick.container!.querySelector('[data-label="paragraph"] .short-cut')).toBeNull();
        hints.strong = 'Ctrl+Alt+F12';
        hints.table = '';
        hints.duplicate = '';
        muya.refreshShortcutHints();
        expect(toolbar.container!.querySelector<HTMLElement>('.strong')!.title).toBe('Emphasize\nCtrl+Alt+F12');
        expect(quick.container!.querySelector('[data-label="table"] .short-cut')).toBeNull();
        expect(quick.activeItem).toBe(activeItem);
        expect(front.container!.querySelector('.duplicate .short-cut')).toBeNull();
        expect(muya.getMarkdown()).toBe('audit\n');
    });

    it('ignores a refresh after the front-menu target is removed', async () => {
        const front = new ParagraphFrontMenu(muya, { getShortcut: () => 'F8' });
        plugins.push(front);
        const block = muya.editor.scrollPage!.firstContentInDescendant()!.parent!;
        muya.eventCenter.emit('muya-front-menu', { reference: muya.domNode, block });
        await vi.waitFor(() => expect(front.status).toBe(true));
        block.remove();
        expect(() => muya.refreshShortcutHints()).not.toThrow();
    });
});
