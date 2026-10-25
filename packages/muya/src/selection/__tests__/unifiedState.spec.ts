// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import type { ISelectionChangePayload, ITextSelectionState, TSelectionState } from '../types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { SelectionType } from '../types';

let muya: Muya;

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'hello 😀 world\n\n![alt](image.png)\n\n| a | b |\n| --- | --- |\n| c | d |\n' });
    muya.init();
});

afterEach(() => {
    muya.destroy();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function text(anchor = 1, focus = 4): ITextSelectionState {
    const path = muya.editor.scrollPage!.firstContentInDescendant()!.path;
    return { kind: SelectionType.TEXT, anchor: { path, offset: anchor }, focus: { path, offset: focus } };
}

function image(): TSelectionState {
    const parent = muya.editor.scrollPage!.find(1)!;
    if (!parent.isParent())
        throw new Error('Expected image paragraph');
    const block = parent.firstContentInDescendant()!;
    return { kind: SelectionType.IMAGE, path: block.path, range: { start: 0, end: block.text.length }, raw: block.text };
}

function table(): TSelectionState {
    return { kind: SelectionType.TABLE, tablePath: [2], anchor: { row: 1, column: 1 }, focus: { row: 0, column: 0 } };
}

describe('unified selection state', () => {
    it('round-trips every kind without runtime references or shared arrays', () => {
        for (const state of [text(4, 1), image(), table()]) {
            expect(muya.setSelection(state)).toBe(true);
            const snapshot = muya.getSelectionState()!;
            expect(snapshot).toEqual(state);
            expect(snapshot).not.toBe(state);
            expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
            expect(snapshot).not.toHaveProperty('context');
            expect(muya.setSelection(null)).toBe(true);
            expect(muya.getSelection()).toBeNull();
            expect(muya.setSelection(snapshot)).toBe(true);
            expect(muya.getSelectionState()).toEqual(state);
        }
        expect(muya.getSelectedText()).toBe('a\tb\nc\td');
    });

    it('strips extra runtime fields from nested coordinates and image ranges', () => {
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        const rectangle = { kind: SelectionType.TABLE as const, tablePath: [2], anchor: { row: 1, column: 1, block }, focus: { row: 0, column: 0, domNode: document.body } };
        expect(muya.setSelection(rectangle)).toBe(true);
        expect(muya.getSelectionState()).toEqual(table());
        const target = image();
        if (target.kind !== SelectionType.IMAGE)
            throw new Error('Expected image state');
        const withRuntimeRange = { ...target, range: { ...target.range, block } };
        expect(muya.setSelection(withRuntimeRange)).toBe(true);
        expect(muya.getSelectionState()).toEqual(target);
    });

    it('rejects invalid targets atomically, including split surrogate pairs', () => {
        muya.setSelection(text());
        const initial = muya.getSelectionState();
        const invalid = [text(-1), text(100), text(7), { ...image(), raw: 'different image' }, { kind: SelectionType.TABLE, tablePath: [2], anchor: { row: -1, column: 0 }, focus: { row: 0, column: 0 } }, { kind: 'text' }];
        for (const state of invalid) {
            expect(muya.setSelection(state as TSelectionState)).toBe(false);
            expect(muya.getSelectionState()).toEqual(initial);
        }
    });

    it('keeps logical text while a tool temporarily owns the native range', () => {
        muya.setSelection(text());
        document.getSelection()?.removeAllRanges();
        expect(muya.getSelectedText()).toBe('ell');
        expect(muya.getSelectionState()).toEqual(text());
    });

    it('publishes the final document and selection once per transaction', () => {
        const listener = vi.fn((_payload: ISelectionChangePayload) => {
            expect(muya.getMarkdown()).toContain('changed');
            expect(muya.getSelectionState()).toEqual(text(0, 7));
        });
        muya.on('selection-change', listener);
        muya.transact(() => {
            const first = muya.editor.scrollPage!.firstContentInDescendant()!;
            first.text = 'changed';
            first.update();
            first.setCursor(0, 3);
            first.setCursor(0, 7);
            expect(listener).not.toHaveBeenCalled();
        });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.lastCall?.[0]).toEqual(expect.objectContaining({ docChanged: true }));
    });

    it('rolls back a failed transaction without publishing intermediate selections', () => {
        muya.setSelection(text());
        const before = muya.getMarkdown();
        const listener = vi.fn();
        muya.on('selection-change', listener);
        expect(() => muya.transact(() => {
            muya.editor.scrollPage!.firstContentInDescendant()!.text = 'temporary';
            muya.setSelection(table());
            throw new Error('cancel');
        })).toThrow('cancel');
        expect(muya.getMarkdown()).toBe(before);
        expect(muya.getSelectionState()).toEqual(text());
        expect(listener).not.toHaveBeenCalled();
    });

    it('notifies when cell content changes at unchanged rectangle coordinates', () => {
        muya.setSelection(table());
        const listener = vi.fn();
        muya.on('selection-change', listener);
        muya.transact(() => muya.editor.selection.table.emptySelectedCells());
        expect(muya.getSelectionState()).toEqual(table());
        expect(muya.getSelectedText()).toBe('\t\n\t');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.lastCall?.[0].docChanged).toBe(true);
        muya.undo();
        expect(muya.getSelectionState()).toEqual(table());
        expect(muya.getSelectedText()).toBe('a\tb\nc\td');
        muya.redo();
        expect(muya.getSelectionState()).toEqual(table());
        expect(muya.getSelectedText()).toBe('\t\n\t');
    });

    it('undo restores an image selection and redo restores the deletion caret', () => {
        const state = image();
        muya.setSelection(state);
        const selection = muya.getSelection();
        if (selection?.kind !== SelectionType.IMAGE)
            throw new Error('Expected image selection');
        muya.transact(() => (selection.context.block as Format).deleteImage(selection.context.imageInfo));
        const after = muya.getSelectionState();
        expect(after?.kind).toBe(SelectionType.TEXT);
        muya.undo();
        expect(muya.getSelectionState()).toEqual(state);
        expect(muya.getSelectedText()).toBe('');
        muya.redo();
        expect(muya.getSelectionState()).toEqual(after);
    });

    it('serializes language and code endpoints to distinct paths', () => {
        muya.setContent('```js\ncode\n```\n');
        const language: ITextSelectionState = {
            kind: SelectionType.TEXT,
            anchor: { path: [0, 'meta', 'lang'], offset: 1 },
            focus: { path: [0, 'text'], offset: 2 },
        };
        expect(muya.setSelection(language)).toBe(true);
        expect(muya.getSelectionState()).toEqual(language);
        const selection = muya.getSelection();
        if (selection?.kind !== SelectionType.TEXT)
            throw new Error('Expected text selection');
        expect(selection.context.anchorBlock.blockName).toBe('language-input');
        expect(selection.context.focusBlock.blockName).toBe('codeblock.content');
        expect(muya.getSelectedText()).toBe('s\nco');
    });

    it('ignores native selections belonging to a different editor', () => {
        muya.setSelection(text());
        const host = document.createElement('div');
        document.body.appendChild(host);
        const other = new Muya(host, { markdown: 'other' });
        other.init();
        try {
            document.dispatchEvent(new Event('selectionchange'));
            expect(muya.getSelectionState()).toEqual(text());
            expect(muya.getSelectedText()).toBe('ell');
        }
        finally {
            other.destroy();
        }
    });

    it.each([false, true])('preserves another editor native selection on load (collapsed: %s)', (collapsed) => {
        const host = document.createElement('div');
        document.body.appendChild(host);
        const inactive = new Muya(host, { markdown: 'inactive' });
        inactive.init({ focus: false });
        try {
            muya.setSelection(text(1, collapsed ? 1 : 4));
            const native = document.getSelection()!;
            const anchor = native.anchorNode;
            const offset = native.anchorOffset;
            const selected = native.toString();
            inactive.setContent('loaded');
            expect(native.rangeCount).toBe(1);
            expect(native.anchorNode).toBe(anchor);
            expect(native.anchorOffset).toBe(offset);
            expect(native.toString()).toBe(selected);
            muya.setSelection(null);
            expect(native.rangeCount).toBe(0);
        }
        finally {
            inactive.destroy();
        }
    });

    it('refreshes explicit image reselection while deduplicating passive notifications', () => {
        muya.setSelection(image());
        const current = muya.getSelection();
        if (current?.kind !== SelectionType.IMAGE)
            throw new Error('Expected image selection');
        const changed = vi.fn();
        muya.on('selection-change', changed);
        muya.editor.selection.notify();
        expect(changed).not.toHaveBeenCalled();
        muya.editor.selection.selectImage({ ...current.context.imageInfo, block: current.context.block });
        expect(changed).toHaveBeenCalledTimes(1);
        expect(changed.mock.lastCall?.[0]).toMatchObject({ selection: { kind: 'image' }, docChanged: false });
        muya.editor.selection.notify();
        expect(changed).toHaveBeenCalledTimes(1);
    });

    it('transitions a read-only rectangle to the complete text selection', () => {
        muya.setReadOnly(true);
        muya.setSelection(table());
        const state = muya.getState();
        const history = muya.getHistory();
        muya.selectAll();
        expect(muya.getSelection()?.kind).toBe(SelectionType.TEXT);
        expect(muya.editor.selection.table.hasSelection).toBe(false);
        expect(muya.getSelectedText()).toContain('hello 😀 world');
        expect(muya.getSelectedText()).toContain('c\nd');
        expect(muya.getState()).toEqual(state);
        expect(muya.getHistory()).toEqual(history);
    });
});
