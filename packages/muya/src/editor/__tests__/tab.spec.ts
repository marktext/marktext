// @vitest-environment happy-dom
import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { createTextSelectionState } from '../../selection/state';

const editors: Muya[] = [];

function boot(markdown: string, tabSize: number | 'tab' = 'tab') {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, tabSize });
    muya.init();
    editors.push(muya);
    return muya;
}

function content(muya: Muya, text: string): Content {
    let found: Content | undefined;
    const visit = (parent: Parent) => parent.forEach((child) => {
        if (child.isContent() && child.text === text)
            found = child;
        else if (child.isParent())
            visit(child);
    });
    visit(muya.editor.scrollPage!);
    if (!found)
        throw new Error(`Missing content ${JSON.stringify(text)}`);
    return found;
}

function select(muya: Muya, a: Content, anchor: number, b = a, focus = anchor) {
    muya.setSelection(createTextSelectionState(
        { block: a, path: a.path, offset: anchor },
        { block: b, path: b.path, offset: focus },
    ));
}

function tab(block: Content, shiftKey = false) {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    block.domNode!.dispatchEvent(event);
    return event;
}

afterEach(() => {
    vi.restoreAllMocks();
    for (const editor of editors.splice(0)) {
        editor.destroy();
        editor.domNode.remove();
    }
    document.getSelection()?.removeAllRanges();
});
describe('real tab input', () => {
    it('inserts one real tab, preserves it on save and undoes in one step', () => {
        const muya = boot('hello\n');
        const block = content(muya, 'hello');
        select(muya, block, 5);
        tab(block);
        expect(muya.getMarkdown()).toBe('hello\t\n');
        expect(block.getCursor()!.start.offset).toBe(6);
        muya.undo();
        expect(muya.getMarkdown()).toBe('hello\n');
        muya.redo();
        expect(muya.getMarkdown()).toBe('hello\t\n');
    });

    it('retains the numeric space behavior and changes options without a content event', () => {
        const muya = boot('hello\n', 2);
        const changed = vi.fn();
        muya.on('json-change', changed);
        muya.setOptions({ tabSize: 'tab' });
        expect(changed).not.toHaveBeenCalled();
        const block = content(muya, 'hello');
        select(muya, block, 5);
        tab(block);
        expect(muya.getMarkdown()).toBe('hello\t\n');
    });

    it('uses a real tab for the extra indentation inside an auto-indent pair', () => {
        const muya = boot('```text\n\t{}\n```\n');
        const block = content(muya, '\t{}');
        select(muya, block, 2);
        block.domNode!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        expect(muya.getMarkdown()).toBe('```text\n\t{\n\t\t\n\t}\n```\n');
    });

    it('does not insert whitespace into the first list item', () => {
        const muya = boot('- a\n- b\n');
        const block = content(muya, 'a');
        select(muya, block, 1);
        tab(block);
        expect(muya.getMarkdown()).toBe('- a\n- b\n');
    });
});
