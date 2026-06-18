// @vitest-environment happy-dom

import type TableBlock from '../../block/gfm/table';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';

// muyajs parity: Backspace/Delete over a frozen table rect clears the selected
// cells (no clipboard write, no table deletion). The `keydown` listener is on
// `document`, so dispatch there to exercise the real handler.

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

function tick(): Promise<void> {
    return new Promise(r => setTimeout(r, 40));
}

// Fire a keyboard delete over the frozen selection. `ownsEvent()` needs
// `document.activeElement` inside `muya.domNode`, so re-focus the (0,0) cell
// before every press — the previous press may have re-rendered the cell.
function pressDelete(table: TableBlock, key: 'Backspace' | 'Delete'): void {
    cellDom(table, 0, 0).focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
}

describe('track C — keydown over a frozen table rect (two-stage, muyajs parity)', () => {
    it('first Backspace clears the selected cells but keeps the frozen selection', async () => {
        const muya = bootMuya('| a1 | b1 | c1 |\n| --- | --- | --- |\n| a2 | b2 | c2 |\n');
        const table = firstTable(muya);

        // Whole columns 0–1 of a 3-column table (all rows, two of three columns).
        dragSelect(table, 0, 0, 1, 1);
        expect(muya.editor.selection.table.hasSelection).toBe(true);

        pressDelete(table, 'Backspace');
        await tick();

        // Cells emptied, but the rectangle stays frozen for a possible second press.
        expect(muya.editor.selection.table.hasSelection).toBe(true);
        const md = muya.getMarkdown();
        expect(md).toContain('|');
        expect(md).not.toMatch(/\ba1\b/);
        expect(md).not.toMatch(/\bb1\b/);
        expect(md).not.toMatch(/\ba2\b/);
        expect(md).not.toMatch(/\bb2\b/);
        expect(md).toContain('c1');
        expect(md).toContain('c2');
    });

    it('a second Backspace on the emptied whole-column selection removes those columns', async () => {
        const muya = bootMuya('| a1 | b1 | c1 |\n| --- | --- | --- |\n| a2 | b2 | c2 |\n');
        const table = firstTable(muya);

        dragSelect(table, 0, 0, 1, 1);
        pressDelete(table, 'Backspace'); // clear
        await tick();
        pressDelete(table, 'Backspace'); // remove the now-empty columns
        await tick();

        expect(table.columnCount).toBe(1);
        expect(muya.editor.selection.table.hasSelection).toBe(false);
        const md = muya.getMarkdown();
        expect(md).toContain('c1');
        expect(md).toContain('c2');
        expect(md).not.toMatch(/\ba1\b/);
        expect(md).not.toMatch(/\bb1\b/);
    });

    it('first Delete clears the selected cells and keeps the selection (Backspace parity)', async () => {
        const muya = bootMuya('| a1 | b1 | c1 |\n| --- | --- | --- |\n| a2 | b2 | c2 |\n');
        const table = firstTable(muya);

        dragSelect(table, 0, 0, 1, 1);
        pressDelete(table, 'Delete');
        await tick();

        expect(muya.editor.selection.table.hasSelection).toBe(true);
        const md = muya.getMarkdown();
        expect(md).not.toMatch(/\ba1\b/);
        expect(md).not.toMatch(/\bb2\b/);
    });

    it('a second Backspace on an emptied PARTIAL rectangle drops the selection without changing the grid', async () => {
        // 3×3 table so a top-left 2×2 spans neither all rows nor all columns.
        const muya = bootMuya('| a | b | c |\n| --- | --- | --- |\n| d | e | f |\n| g | h | i |\n');
        const table = firstTable(muya);

        dragSelect(table, 0, 0, 1, 1);
        pressDelete(table, 'Backspace'); // clear
        await tick();
        expect(muya.editor.selection.table.hasSelection).toBe(true);

        pressDelete(table, 'Backspace'); // partial empty → just deselect
        await tick();

        expect(muya.editor.selection.table.hasSelection).toBe(false);
        expect(table.rowCount).toBe(3);
        expect(table.columnCount).toBe(3);
    });
});
