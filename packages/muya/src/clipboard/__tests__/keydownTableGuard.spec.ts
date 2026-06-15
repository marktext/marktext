// @vitest-environment happy-dom

import type TableBlock from '../../block/gfm/table';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';

// A plain Backspace/Delete while a table rectangle is frozen must NOT fall
// through to `cutHandler()`. The `keydownHandler` short-circuits on
// `selection.table.hasSelection`, so the selected cells keep their text. The
// document-level `keydown` listener is registered via
// `eventCenter.attachDOMEvent(document, 'keydown', ...)`, so dispatching the
// event on `document` exercises the real handler.

// The clipboard module pulls in CodeBlockContent → utils/prism which touches
// `window` at import time. Stub the prism shim (same stub as sibling specs).
vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

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

function firstTable(muya: Muya): TableBlock {
    return muya.editor.scrollPage!.firstContentInDescendant()!.closestBlock('table') as TableBlock;
}

function cellDom(table: TableBlock, row: number, column: number): HTMLElement {
    const cell = table.cellAt(row, column)!;
    return (cell.firstChild as { domNode: HTMLElement }).domNode;
}

function fireMouse(node: HTMLElement, type: string): void {
    const event = new MouseEvent(type, { bubbles: true, button: 0 });
    if (!('x' in event))
        Object.defineProperty(event, 'x', { value: 0, configurable: true });
    node.dispatchEvent(event);
}

// Build a genuine frozen rectangle selection through real DOM mouse events
// (same pattern as selection/__tests__/TableRectSelection.spec.ts).
function dragSelect(table: TableBlock, r1: number, c1: number, r2: number, c2: number): void {
    fireMouse(cellDom(table, r1, c1), 'mousedown');
    fireMouse(cellDom(table, r2, c2), 'mousemove');
    fireMouse(cellDom(table, r2, c2), 'mouseup');
}

describe('track C — keydown table.hasSelection guard', () => {
    it('a plain Backspace over a frozen table rect does not empty the cells', async () => {
        const muya = bootMuya('| a1 | b1 |\n| --- | --- |\n| a2 | b2 |\n');
        const table = firstTable(muya);

        // Freeze the whole 2x2 body grid so `selection.table.hasSelection`.
        dragSelect(table, 0, 0, 1, 1);
        expect(muya.editor.selection.table.hasSelection).toBe(true);

        // `ownsEvent()` requires `document.activeElement` inside `muya.domNode`.
        cellDom(table, 0, 0).focus();
        expect(muya.domNode.contains(document.activeElement)).toBe(true);

        const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
        document.dispatchEvent(event);

        // The frozen selection still stands and the cells keep their text —
        // the guard stopped the handler before `cutHandler()` ran.
        await new Promise(r => setTimeout(r, 40));
        expect(muya.editor.selection.table.hasSelection).toBe(true);
        const md = muya.getMarkdown();
        expect(md).toContain('a1');
        expect(md).toContain('b1');
        expect(md).toContain('a2');
        expect(md).toContain('b2');
    });

    it('a plain Delete over a frozen table rect does not empty the cells', async () => {
        const muya = bootMuya('| a1 | b1 |\n| --- | --- |\n| a2 | b2 |\n');
        const table = firstTable(muya);

        dragSelect(table, 0, 0, 1, 1);
        expect(muya.editor.selection.table.hasSelection).toBe(true);

        cellDom(table, 0, 0).focus();
        expect(muya.domNode.contains(document.activeElement)).toBe(true);

        const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
        document.dispatchEvent(event);

        await new Promise(r => setTimeout(r, 40));
        expect(muya.editor.selection.table.hasSelection).toBe(true);
        const md = muya.getMarkdown();
        expect(md).toContain('a1');
        expect(md).toContain('b1');
        expect(md).toContain('a2');
        expect(md).toContain('b2');
    });
});
