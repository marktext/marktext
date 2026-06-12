// @vitest-environment happy-dom

import type Table from '../../block/gfm/table';
import type { IImageSelectionData } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Coverage for the Selection facade (Task 3 of the selection-module refactor):
//   - `type` reports the active SelectionType ('text' | 'table' | 'image').
//   - `activate(type)` enforces mutual exclusivity and emits a
//     `selection-change` payload carrying the new `kind` discriminator.
//   - `clear()` returns to the text selection.
//   - a plain text `setSelection` keeps `type === 'text'`, emits `kind: 'text'`,
//     and preserves the legacy Caret/Range/None `type` field on the payload.

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

describe('selection facade', () => {
    it('reports type "text" after a normal text setSelection', () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        muya.editor.selection.setSelection({
            anchor: { offset: 0 },
            focus: { offset: 5 },
            block: first,
            path: first.path,
        });

        expect(muya.editor.selection.type).toBe('text');
    });

    it('activating image sets type to "image" and emits kind "image"', () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        let payload: Record<string, unknown> | null = null;
        muya.on('selection-change', (p: unknown) => {
            payload = p as Record<string, unknown>;
        });

        muya.editor.selection.selectImage({
            token: {},
            imageId: 'image-1',
            block: first,
        } as unknown as IImageSelectionData);

        expect(muya.editor.selection.type).toBe('image');
        expect(payload).not.toBeNull();
        expect(payload!.kind).toBe('image');
    });

    it('clear() returns type to "text"', () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        muya.editor.selection.selectImage({
            token: {},
            imageId: 'image-1',
            block: first,
        } as unknown as IImageSelectionData);
        expect(muya.editor.selection.type).toBe('image');

        muya.editor.selection.clear();

        expect(muya.editor.selection.type).toBe('text');
        expect(muya.editor.selection.image).toBeNull();
    });

    it('reports type "table" and current table while a table rectangle is frozen', () => {
        const muya = bootMuya('| a | b |\n| --- | --- |\n| c | d |\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const table = first.closestBlock('table') as Table;
        const { selection } = muya.editor;

        selection.table.selectTable(table);

        expect(selection.type).toBe('table');
        expect(selection.current).toBe(selection.table);

        selection.clear();

        expect(selection.type).toBe('text');
    });

    it('text setSelection emits kind "text" while preserving the legacy type field', () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        let payload: Record<string, unknown> | null = null;
        muya.on('selection-change', (p: unknown) => {
            payload = p as Record<string, unknown>;
        });

        muya.editor.selection.setSelection({
            anchor: { offset: 0 },
            focus: { offset: 5 },
            block: first,
            path: first.path,
        });

        expect(payload).not.toBeNull();
        expect(payload!.kind).toBe('text');
        expect(['Caret', 'Range', 'None']).toContain(payload!.type);
    });
});
