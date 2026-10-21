// @vitest-environment happy-dom

import type Content from '../../../base/content';
import type Table from '../../../gfm/table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

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
    document.getSelection()?.removeAllRanges();
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
    bootedHosts.push(muya.domNode);
    return muya;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function firstContent(muya: Muya): Content {
    return muya.editor.scrollPage!.firstContentInDescendant() as Content;
}

function findTable(muya: Muya): Table | null {
    let table: Table | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'table')
            table = block as unknown as Table;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    return table;
}

function enterWithText(muya: Muya, text: string): Content {
    const content = firstContent(muya);
    content.text = text;
    muya.editor.activeContentBlock = content;
    const offset = content.text.length;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Enter',
        shiftKey: false,
    } as unknown as KeyboardEvent;
    content.enterHandler(event);
    return content;
}

describe('paragraphContent.enterHandler — pipe-table conversion', () => {
    it('converts `| a | b |` into a 2-column table', async () => {
        const muya = bootMuya('placeholder');

        enterWithText(muya, '| a | b |');

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('table');

        const table = findTable(muya);
        expect(table).not.toBeNull();
        expect(table!.columnCount).toBe(2);
        expect(table!.rowCount).toBe(2);
    });

    it('lands the caret in the first BODY cell (row 1, column 0)', async () => {
        const muya = bootMuya('placeholder');

        enterWithText(muya, '| a | b |');

        await flush();
        const anchorBlock = muya.editor.selection.anchorBlock;
        expect(anchorBlock).not.toBeNull();
        expect(anchorBlock!.blockName).toBe('table.cell.content');

        const cell = anchorBlock!.closestBlock('table.cell') as {
            rowOffset: number;
            columnOffset: number;
        } | null;
        expect(cell).not.toBeNull();
        expect(cell!.rowOffset).toBe(1);
        expect(cell!.columnOffset).toBe(0);
    });

    it('keeps the header text in the first row\'s cells', async () => {
        const muya = bootMuya('placeholder');

        enterWithText(muya, '| a | b |');

        await flush();
        const table = findTable(muya)!;
        const tableState = table.getState();
        const headerRow = tableState.children[0];
        expect(headerRow.children.length).toBe(2);
        // parseTableHeader keeps the surrounding spaces from the cell text.
        expect(headerRow.children[0].text).toBe(' a ');
        expect(headerRow.children[1].text).toBe(' b ');
        const bodyRow = tableState.children[1];
        expect(bodyRow.children.every(c => c.text === '')).toBe(true);
    });

    it('converts `| a | b | c |` into a 3-column table', async () => {
        const muya = bootMuya('placeholder');

        enterWithText(muya, '| a | b | c |');

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('table');

        const table = findTable(muya)!;
        expect(table.columnCount).toBe(3);
        expect(table.rowCount).toBe(2);
    });

    it('does NOT convert `| a \\| b |` (odd/escaped pipe) — stays a paragraph', async () => {
        const muya = bootMuya('placeholder');

        const content = enterWithText(muya, '| a \\| b |');

        await flush();
        const state = muya.getState();
        expect(findTable(muya)).toBeNull();
        expect(state.every(block => block.name === 'paragraph')).toBe(true);
        expect(content.blockName).toBe('paragraph.content');
    });
});
