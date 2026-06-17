// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// muyajs trims pasted table-cell text and normalizes CRLF to LF before folding
// newlines into `<br/>`. A table cell takes the paste literally, so a stray
// `\r` would otherwise survive verbatim — the ideal place to pin both fixes.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

vi.mock('../../utils/paste', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/paste')>();
    return { ...actual, normalizePastedHTML: async (html: string) => html };
});

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstCellContent(muya: Muya): Content {
    // The first content leaf of a table-first document is the first header cell.
    return muya.editor.scrollPage!.firstContentInDescendant()!;
}

function stubSelection(muya: Muya, block: Content, start: number, end: number) {
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: start, block, path },
        focus: { offset: end, block, path },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
}

function pasteEvent(text: string) {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: {
            getData: (t: string) => (t === 'text/plain' ? text : ''),
            files: [],
            items: [],
        },
    } as unknown as ClipboardEvent;
}

async function pasteInto(muya: Muya, block: Content, start: number, end: number, text: string) {
    stubSelection(muya, block, start, end);
    await muya.editor.clipboard.pasteHandler(pasteEvent(text), text, '');
    await new Promise(r => setTimeout(r, 40));
}

describe('paste — table cell takes text literally (muyajs parity)', () => {
    it('trims surrounding whitespace from a normal cell paste', async () => {
        const muya = bootMuya('| a1 | b1 |\n| --- | --- |\n| a2 | b2 |\n');
        const cell = firstCellContent(muya); // header cell 'a1'
        await pasteInto(muya, cell, 0, cell.text.length, '  hi  ');
        expect(cell.text).toBe('hi');
    });

    it('normalizes CRLF to LF so no stray carriage return survives', async () => {
        const muya = bootMuya('| a1 | b1 |\n| --- | --- |\n| a2 | b2 |\n');
        const cell = firstCellContent(muya);
        await pasteInto(muya, cell, 0, cell.text.length, 'x\r\ny');
        // newlines fold to <br/>; the carriage return must be gone, not kept.
        expect(cell.text).toBe('x<br/>y');
    });
});
