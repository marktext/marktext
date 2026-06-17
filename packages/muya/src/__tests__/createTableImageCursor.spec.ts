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
        expect(sel!.anchor.block.blockName).toBe('table.cell.content');
    });

    it('is a no-op when there is no current block', () => {
        const muya = bootMuya('hello\n');
        muya.editor.activeContentBlock = null;
        muya.editor.selection.clear();
        expect(() => muya.createTable({ rows: 2, columns: 2 })).not.toThrow();
        expect(firstBlock(muya).name).toBe('paragraph');
    });

    it('clamps zero/negative dimensions to a valid table (rows >= 2, columns >= 1)', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        // rows = 0 would otherwise build a table with no rows and crash
        // `Table.columnCount` (which reads `firstChild.firstChild`).
        expect(() => muya.createTable({ rows: 0, columns: 0 })).not.toThrow();
        await vi.waitFor(() => {
            const b = firstTable(muya);
            expect(b.children.length).toBe(2); // header + one body row
            expect(b.children.every(row => row.children.length === 1)).toBe(true);
        });
    });

    it('coerces non-finite / fractional dimensions to integers', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        expect(() =>
            muya.createTable({ rows: Number.NaN, columns: Number.POSITIVE_INFINITY }),
        ).not.toThrow();
        await vi.waitFor(() => {
            const b = firstTable(muya);
            // NaN -> clamped to 2 rows; Infinity column count is not finite so it
            // also normalises to the minimum of 1 column rather than allocating
            // an array of non-integer length.
            expect(b.children.length).toBe(2);
            expect(b.children.every(row => row.children.length === 1)).toBe(true);
        });
    });

    it('floors fractional dimensions instead of building a ragged table', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        muya.createTable({ rows: 3.9, columns: 2.9 });
        await vi.waitFor(() => {
            const b = firstTable(muya);
            expect(b.children.length).toBe(3); // floor(3.9)
            expect(b.children.every(row => row.children.length === 2)).toBe(true); // floor(2.9)
        });
    });

    it('inserts the table BELOW a non-empty heading instead of replacing it', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya, 4); // caret inside the heading text
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(2);
            expect(s[0].name).toBe('atx-heading'); // heading kept
            expect(s[1].name).toBe('table'); // table directly below
        });
        // the new table gets focus (caret in its first cell)
        const sel = muya.editor.selection.getSelection();
        expect(sel!.anchor.block.blockName).toBe('table.cell.content');
    });

    it('inserts the table BELOW a non-empty paragraph instead of replacing it', async () => {
        const muya = bootMuya('hello\n');
        placeCursorOnFirstBlock(muya, 5);
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(2);
            expect(s[0].name).toBe('paragraph');
            expect((s[0] as { text: string }).text).toBe('hello');
            expect(s[1].name).toBe('table');
        });
    });

    it('replaces a non-empty block in place when { replace: true } (grid picker path)', async () => {
        const muya = bootMuya('/table\n'); // a non-empty quick-insert trigger line
        placeCursorOnFirstBlock(muya, 6);
        muya.createTable({ rows: 2, columns: 2 }, { replace: true });
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(1); // trigger consumed, not left behind
            expect(s[0].name).toBe('table');
        });
    });

    it('inserts the table right after the paragraph INSIDE a list item, not after the list', async () => {
        const muya = bootMuya('- item text\n');
        placeCursorOnFirstBlock(muya, 4);
        muya.createTable({ rows: 2, columns: 2 });
        await vi.waitFor(() => {
            const s = muya.getState();
            // a single top-level bullet-list — the table did NOT land after it
            expect(s.length).toBe(1);
            expect(s[0].name).toBe('bullet-list');
            const item = (s[0] as { children: { children: { name: string }[] }[] }).children[0];
            expect(item.children.map(c => c.name)).toEqual(['paragraph', 'table']);
        });
        // the nested table still serializes without throwing
        expect(() => muya.getMarkdown()).not.toThrow();
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
        muya.editor.selection.clear();
        expect(() => muya.insertImage({ src: 'https://example.com/x.png' })).not.toThrow();
        expect(muya.getMarkdown()).not.toContain('![');
    });

    it('embeds a well-formed base64 data URL verbatim', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya, 0);
        const dataUrl
            = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
        muya.insertImage({ src: dataUrl, alt: 'dot' });
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain(`![dot](${dataUrl})`);
        });
    });

    it('does not embed a malformed data: src verbatim (aligns with strict DATA_URL_REG)', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya, 0);
        // `data:image/` prefix with no comma/payload — the old loose
        // `^data:image/` check would have embedded it verbatim. It must instead
        // fall through to the plain-path branch (spaces and '#' percent-encoded).
        const malformed = 'data:image/png not-a-real#payload';
        muya.insertImage({ src: malformed, alt: 'bad' });
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            // Treated as a plain path: spaces and '#' are percent-encoded, so the
            // raw malformed string is not present verbatim.
            expect(md).not.toContain(`(${malformed})`);
            expect(md).toContain('data:image/png%20not-a-real%23payload');
        });
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
            expect(sel!.anchor.block).toBe(first);
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
            expect(sel!.anchor.block).toBe(first);
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
            expect(sel!.anchor.block).toBe(secondContent);
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
