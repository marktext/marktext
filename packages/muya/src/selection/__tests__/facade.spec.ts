import type Format from '../../block/base/format';

import type Table from '../../block/gfm/table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { getImageInfo } from '../../utils/image';
// @vitest-environment happy-dom
import { createTextSelectionState } from '../state';
import { SelectionType } from '../types';

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

        muya.editor.selection.setSelection(
            createTextSelectionState(
                {
                    offset: 0,
                    block: first,
                    path: first.path,
                },
                {
                    offset: 5,
                    block: first,
                    path: first.path,
                },
            ),
        );

        expect(muya.editor.selection.type).toBe('text');
    });

    it('selects an image, emits the unified payload and clears to null', () => {
        const muya = bootMuya('![alt](image.png)\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
        const wrapper = first.domNode!.querySelector<HTMLElement>('.mu-inline-image')!;
        const listener = vi.fn();
        muya.on('selection-change', listener);
        muya.editor.selection.selectImage({
            ...getImageInfo(wrapper),
            block: first,
        });
        expect(muya.getSelection()?.kind).toBe(SelectionType.IMAGE);
        expect(listener.mock.lastCall?.[0].selection.kind).toBe(SelectionType.IMAGE);
        expect(muya.getSelectedText()).toBe('');
        muya.editor.selection.clear();
        expect(muya.getSelection()).toBeNull();
    });

    it('reports type "table" and current table while a table rectangle is frozen', () => {
        const muya = bootMuya('| a | b |\n| --- | --- |\n| c | d |\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const table = first.closestBlock('table') as Table;
        const { selection } = muya.editor;

        selection.table.selectTable(table);

        expect(selection.type).toBe('table');
        expect(muya.getSelection()?.kind).toBe(SelectionType.TABLE);
        expect(muya.getSelectedText()).toBe('a\tb\nc\td');

        selection.clear();

        expect(selection.type).toBeNull();
    });

    it('text setSelection emits only the unified event fields', () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;

        let payload: Record<string, unknown> | null = null;
        muya.on('selection-change', (p: unknown) => {
            payload = p as Record<string, unknown>;
        });

        muya.editor.selection.setSelection(
            createTextSelectionState(
                {
                    offset: 0,
                    block: first,
                    path: first.path,
                },
                {
                    offset: 5,
                    block: first,
                    path: first.path,
                },
            ),
        );

        expect(payload).not.toBeNull();
        expect(payload).toHaveProperty('selection.kind', 'text');
        expect(Object.keys(payload!).sort()).toEqual(['docChanged', 'selection']);
    });
});
