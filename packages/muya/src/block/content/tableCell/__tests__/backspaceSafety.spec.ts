// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// DATA-LOSS GUARD — `TableCellContent.backspaceHandler` deletion safety.
//
// Backspace at the start of a table cell has two branches the migration audit
// flagged as untested:
//   1. Whole table empty AND no previous content cell → the table is replaced
//      with an empty paragraph and the caret lands there (so the user can keep
//      typing) rather than the keystroke being swallowed or the table left in a
//      broken state.
//   2. A previous cell exists → the caret jumps to the END of the previous
//      cell; the table is NOT destructively merged and no content is lost.
// Both branches are driven here through a real boot so the cell-resolution and
// caret-placement run exactly as a Backspace keystroke would.

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

// Collect the table cell content blocks in document order.
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

function backspaceAtStart(muya: Muya, cell: Content): void {
    muya.editor.activeContentBlock = cell;
    cell.setCursor(0, 0, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Backspace',
    } as unknown as KeyboardEvent;
    cell.backspaceHandler(event);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('tableCellContent backspace deletion safety', () => {
    it('replaces a wholly-empty table with an empty paragraph when there is no previous content', async () => {
        // 2x2 table with every cell empty, nothing before it in the document.
        const muya = bootMuya('|  |  |\n| --- | --- |\n|  |  |\n');
        const cells = tableCells(muya);
        expect(cells.length).toBe(4);

        backspaceAtStart(muya, cells[0]);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('paragraph');
        // The replacement is a paragraph state, which carries `text`.
        expect((state[0] as { text: string }).text).toBe('');
    });

    it('jumps the caret to the end of the previous cell without destroying the table', async () => {
        const muya = bootMuya('| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);
        const secondCell = cells[1]; // header cell `cd`

        backspaceAtStart(muya, secondCell);

        await flush();
        // The table is intact — no destructive merge.
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('table');

        // The caret moved to the END of the previous cell (`ab`, length 2).
        const previousCell = cells[0];
        const cursor = previousCell.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(previousCell.text.length);
        expect(previousCell.text).toBe('ab');
    });

    it('preserves all cell text when backspacing at the start of a non-first cell', async () => {
        const muya = bootMuya('| ab | cd |\n| --- | --- |\n| ef | gh |\n');
        const cells = tableCells(muya);

        backspaceAtStart(muya, cells[1]);

        await flush();
        const md = muya.getMarkdown();
        for (const text of ['ab', 'cd', 'ef', 'gh'])
            expect(md).toContain(text);
    });
});
