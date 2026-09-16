// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #5386 — forward Delete at the end of the last cell merges the next paragraph
// into the cell. Blocks that followed that paragraph were moved into the table
// row, so the flush threw "Cannot use numerical key for object container" and
// every later edit stayed queued behind the failed operation.

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

function deleteAtEnd(muya: Muya, cell: Content): void {
    muya.editor.activeContentBlock = cell;
    const offset = cell.text.length;
    cell.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Delete',
    } as unknown as KeyboardEvent;
    cell.deleteHandler(event);
}

describe('forward Delete at the end of a table\'s last cell (#5386)', () => {
    it('keeps the block after the merged paragraph below the table', () => {
        const muya = bootMuya('| x | y |\n| - | - |\n| 1 | 2 |\n\np\n\nq\n');
        const cells = tableCells(muya);

        deleteAtEnd(muya, cells[3]);

        expect(() => muya.flush()).not.toThrow();
        expect(muya.getMarkdown()).toBe(
            '| x   | y   |\n| --- | --- |\n| 1   | 2p  |\n\nq\n',
        );
    });

    it('applies later edits', () => {
        const muya = bootMuya('| x | y |\n| - | - |\n| 1 | 2 |\n\np\n\nq\n');
        const cells = tableCells(muya);
        deleteAtEnd(muya, cells[3]);
        muya.flush();

        cells[0].text = 'xw';

        expect(() => muya.flush()).not.toThrow();
        expect(muya.getMarkdown()).toBe(
            '| xw  | y   |\n| --- | --- |\n| 1   | 2p  |\n\nq\n',
        );
    });

    it('moves the merged list item\'s sublist after the table, not into it', () => {
        const muya = bootMuya('- a\n\n  | x | y |\n  | - | - |\n  | 1 | 2 |\n- b\n  - c\n');
        const cells = tableCells(muya);

        deleteAtEnd(muya, cells[3]);

        expect(() => muya.flush()).not.toThrow();
        expect(muya.getMarkdown()).toBe(
            '- a\n\n  | x   | y   |\n  | --- | --- |\n  | 1   | 2b  |\n\n  - c\n',
        );
    });
});
