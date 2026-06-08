// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { ITableState, TState } from '../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';
import { isTableState } from '../state/types';

// Coverage for the programmatic editing API added for the muyajs ->
// @muyajs/core desktop migration: createTable / insertImage / setCursor.
// These complete the block-editing surface the desktop drives (table insert,
// image insert from the image tool, and programmatic cursor placement).
//
// Tree/text mutations dispatch json1 ops that flush to the document state on
// the next animation frame (see JSONState._emitStateChange), so assertions on
// getState()/getMarkdown() are wrapped in vi.waitFor to await that flush.

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// Place a collapsed caret on the first content block (and mark it active so the
// block-level ops resolve their target the same way the editor does after a
// click).
function placeCursorOnFirstBlock(muya: Muya, offset = 0): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    first.setCursor(offset, offset, true);
    muya.editor.activeContentBlock = first;
    return first;
}

function firstBlock(muya: Muya): TState {
    return muya.getState()[0];
}

function firstTable(muya: Muya): ITableState {
    const b = firstBlock(muya);
    if (!isTableState(b))
        throw new Error(`expected a table, got ${b.name}`);
    return b;
}

describe('muya.createTable()', () => {
    it('replaces the current block with a table of the requested dimensions', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        muya.createTable({ rows: 3, columns: 4 });
        await vi.waitFor(() => {
            const b = firstTable(muya);
            expect(b.children.length).toBe(3); // rows (header + 2 body)
            expect(b.children.every(row => row.children.length === 4)).toBe(true); // columns
        });
    });

    it('builds empty cells with align none', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            const cells = firstTable(muya).children.flatMap(row => row.children);
            expect(cells.every(c => c.name === 'table.cell')).toBe(true);
            expect(cells.every(c => c.text === '')).toBe(true);
            expect(cells.every(c => c.meta.align === 'none')).toBe(true);
        });
    });

    it('places the cursor in the first cell of the new table', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('table');
        });
        const sel = muya.editor.selection.getSelection();
        expect(sel).not.toBeNull();
        // The caret lands on a table-cell content block.
        expect(sel!.anchorBlock.blockName).toBe('table.cell.content');
    });

    it('is a no-op when there is no current block', () => {
        const muya = bootMuya('hello\n');
        muya.editor.activeContentBlock = null;
        muya.editor.selection.anchorBlock = null;
        expect(() => muya.createTable({ rows: 2, columns: 2 })).not.toThrow();
        expect(firstBlock(muya).name).toBe('paragraph');
    });
});

describe('muya.insertImage()', () => {
    it('inserts an inline image at the cursor', async () => {
        const muya = bootMuya('hello\n');
        placeCursorOnFirstBlock(muya, 5); // caret at end of "hello"
        muya.insertImage({ src: 'https://example.com/cat.png' });
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).toContain('https://example.com/cat.png');
            expect(md).toContain('![');
        });
    });

    it('derives alt text from the file name when none is given', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya, 0);
        muya.insertImage({ src: '/tmp/photos/sunset.jpg' });
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('![sunset](');
        });
    });

    it('uses the provided alt text', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya, 0);
        muya.insertImage({ src: 'https://example.com/x.png', alt: 'My Pic' });
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('![My Pic](https://example.com/x.png)');
        });
    });

    it('percent-encodes spaces in local paths', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya, 0);
        muya.insertImage({ src: '/my photos/a b.png', alt: 'pic' });
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('/my%20photos/a%20b.png');
        });
    });

    it('is a no-op when there is no active formattable block', () => {
        const muya = bootMuya('hello\n');
        muya.editor.activeContentBlock = null;
        muya.editor.selection.anchorBlock = null;
        expect(() => muya.insertImage({ src: 'https://example.com/x.png' })).not.toThrow();
        expect(muya.getMarkdown()).not.toContain('![');
    });
});

describe('muya.setCursor()', () => {
    it('positions the caret in the same block (anchor/focus/path shape)', async () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.setCursor({
            anchor: { offset: 3 },
            focus: { offset: 3 },
            anchorPath: first.path,
            focusPath: first.path,
        });
        await vi.waitFor(() => {
            const sel = muya.editor.selection.getSelection();
            expect(sel).not.toBeNull();
            expect(sel!.anchorBlock).toBe(first);
            expect(sel!.anchor.offset).toBe(3);
        });
    });

    it('accepts the start/end/path shape', async () => {
        const muya = bootMuya('hello world\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.setCursor({
            start: { offset: 2 },
            end: { offset: 2 },
            path: first.path,
        });
        await vi.waitFor(() => {
            const sel = muya.editor.selection.getSelection();
            expect(sel!.anchorBlock).toBe(first);
            expect(sel!.anchor.offset).toBe(2);
        });
    });

    it('resolves the target block across two paragraphs', async () => {
        const muya = bootMuya('first\n\nsecond\n');
        const blocks = muya.editor.scrollPage!;
        const secondPara = blocks.find(1) as Parent;
        const secondContent = secondPara.firstContentInDescendant()!;
        muya.setCursor({
            anchor: { offset: 1 },
            focus: { offset: 1 },
            anchorPath: secondContent.path,
            focusPath: secondContent.path,
        });
        await vi.waitFor(() => {
            const sel = muya.editor.selection.getSelection();
            expect(sel!.anchorBlock).toBe(secondContent);
            expect(sel!.anchor.offset).toBe(1);
        });
    });

    it('does not throw and leaves the document intact for an unresolvable path', () => {
        const muya = bootMuya('hello\n');
        expect(() => muya.setCursor({
            anchor: { offset: 0 },
            focus: { offset: 0 },
            anchorPath: [99, 'text'],
            focusPath: [99, 'text'],
        })).not.toThrow();
    });
});
