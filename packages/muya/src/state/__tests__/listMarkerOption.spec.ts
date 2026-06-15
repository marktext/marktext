// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

// Characterization coverage for the list-marker / ordered-delimiter Muya
// options as they thread through `replaceBlockByLabel` (the path
// `updateParagraph` drives) into the serialized markdown. The marker the
// list is created with lives in the list block's `meta` and is emitted
// verbatim by stateToMarkdown, so booting Muya with `bulletListMarker` /
// `orderListDelimiter` and creating a list through `updateParagraph` lets us
// pin the produced markdown. State flushes on rAF, so assertions wait via
// vi.waitFor.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, options: Partial<ConstructorParameters<typeof Muya>[1]> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    return first;
}

// eslint-disable-next-line ts/no-explicit-any
function firstBlock(muya: Muya): any {
    return muya.getState()[0];
}

describe('list marker option — bulletListMarker', () => {
    it('default bullet list uses "- " marker', async () => {
        const muya = bootMuya('item\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('bullet-list');
            expect(firstBlock(muya).meta.marker).toBe('-');
        });
        const lines = muya.getMarkdown().split('\n').filter(l => l.trim() !== '');
        expect(lines[0].startsWith('- ')).toBe(true);
    });

    it('{bulletListMarker:"*"} emits "* " markers', async () => {
        const muya = bootMuya('item\n', { bulletListMarker: '*' });
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('bullet-list');
            expect(firstBlock(muya).meta.marker).toBe('*');
        });
        const lines = muya.getMarkdown().split('\n').filter(l => l.trim() !== '');
        expect(lines[0].startsWith('* ')).toBe(true);
        expect(lines[0].startsWith('- ')).toBe(false);
    });

    it('{bulletListMarker:"+"} emits "+ " markers', async () => {
        const muya = bootMuya('item\n', { bulletListMarker: '+' });
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('bullet-list');
            expect(firstBlock(muya).meta.marker).toBe('+');
        });
        const lines = muya.getMarkdown().split('\n').filter(l => l.trim() !== '');
        expect(lines[0].startsWith('+ ')).toBe(true);
    });
});

describe('list marker option — orderListDelimiter', () => {
    it('default ordered list uses "1. " delimiter', async () => {
        const muya = bootMuya('item\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ol-order');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('order-list');
            expect(firstBlock(muya).meta.delimiter).toBe('.');
        });
        const lines = muya.getMarkdown().split('\n').filter(l => l.trim() !== '');
        expect(lines[0].startsWith('1. ')).toBe(true);
    });

    it('{orderListDelimiter:")"} emits "1) " not "1. "', async () => {
        const muya = bootMuya('item\n', { orderListDelimiter: ')' });
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ol-order');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('order-list');
            expect(firstBlock(muya).meta.delimiter).toBe(')');
        });
        const lines = muya.getMarkdown().split('\n').filter(l => l.trim() !== '');
        expect(lines[0].startsWith('1) ')).toBe(true);
        expect(lines[0].startsWith('1. ')).toBe(false);
    });

    it('{orderListDelimiter:")"} carries to the ol-bullet command label too', async () => {
        const muya = bootMuya('item\n', { orderListDelimiter: ')' });
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ol-bullet');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('order-list');
            expect(firstBlock(muya).meta.delimiter).toBe(')');
        });
        const lines = muya.getMarkdown().split('\n').filter(l => l.trim() !== '');
        expect(lines[0].startsWith('1) ')).toBe(true);
    });
});
