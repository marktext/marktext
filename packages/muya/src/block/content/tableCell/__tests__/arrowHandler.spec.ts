// @vitest-environment happy-dom

import type Content from '../../../base/content';
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

function tableCells(muya: Muya): Content[] {
    const out: Content[] = [];
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'table.cell.content')
            out.push(block as unknown as Content);
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    return out;
}

function arrowAtStart(muya: Muya, cell: Content, key: 'ArrowUp' | 'ArrowDown'): void {
    muya.editor.activeContentBlock = cell;
    cell.setCursor(0, 0, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key,
    } as unknown as KeyboardEvent;
    cell.arrowHandler(event);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('tableCellContent arrow navigation', () => {
    it('arrowDown from a header cell lands the caret in the same column of the body row', async () => {
        const muya = bootMuya('| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);
        expect(cells.length).toBe(4);

        arrowAtStart(muya, cells[0], 'ArrowDown');
        await flush();

        const bodyCol0 = cells[2];
        expect(bodyCol0.text).toBe('ef');
        const cursor = bodyCol0.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
    });

    it('arrowDown preserves the column index when moving down (column 1)', async () => {
        const muya = bootMuya('| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);

        arrowAtStart(muya, cells[1], 'ArrowDown');
        await flush();

        const bodyCol1 = cells[3];
        expect(bodyCol1.text).toBe('gh');
        const cursor = bodyCol1.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);

        expect(cells[2].getCursor()).toBeNull();
    });

    it('arrowDown from the last body cell with no following block appends a trailing paragraph and lands the caret there', async () => {
        const muya = bootMuya('| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);
        expect(cells.length).toBe(4);

        arrowAtStart(muya, cells[3], 'ArrowDown');
        await flush();

        const state = muya.getState();
        expect(state.length).toBe(2);
        expect(state[0].name).toBe('table');
        expect(state[1].name).toBe('paragraph');
        expect((state[1] as { text: string }).text).toBe('');

        const appended = muya.editor.scrollPage!.lastContentInDescendant() as Content;
        expect(appended.constructor.name).toBe('ParagraphContent');
        const cursor = appended.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
    });

    it('arrowUp from a header cell with a preceding paragraph jumps the caret to the END of that paragraph', async () => {
        const muya = bootMuya('intro\n\n| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);
        expect(cells.length).toBe(4);

        arrowAtStart(muya, cells[0], 'ArrowUp');
        await flush();

        const first = muya.editor.scrollPage!.firstContentInDescendant() as Content;
        expect(first.text).toBe('intro');
        const cursor = first.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe('intro'.length);
        expect(cursor!.end.offset).toBe('intro'.length);
    });

    it('arrowUp from a body cell lands the caret in the same column of the header row', async () => {
        const muya = bootMuya('| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);

        arrowAtStart(muya, cells[3], 'ArrowUp');
        await flush();

        const headerCol1 = cells[1];
        expect(headerCol1.text).toBe('cd');
        const cursor = headerCol1.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe('cd'.length);
    });
});
