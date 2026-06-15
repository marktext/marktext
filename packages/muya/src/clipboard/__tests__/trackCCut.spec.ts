// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type TableBlock from '../../block/gfm/table';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// Track C — Cut (clipboard chain step 2). Ports `packages/muyajs`
// `copyCutCtrl.cutHandler` + `removeBlocks` semantics into `@muyajs/core`:
//   1. A cross-block cut merges at the LEAF level —
//      `startBlock.text = start.head + end.tail` — keeping BOTH endpoint tails
//      and removing only the structure strictly between. The start block keeps
//      its container (list item stays a list item, blockquote stays a quote).
//   2. A whole-document selection collapses to a single empty paragraph
//      (muyajs `isSelectAll` reset).
//   3. An empty whole-row / whole-column / whole-table table-cell cut removes
//      that row / column / table structurally.

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

// Document-order list of every content leaf.
function contentBlocks(muya: Muya): Content[] {
    const out: Content[] = [];
    let c: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (c) {
        out.push(c);
        c = c.nextContentInContext() ?? null;
    }
    return out;
}

// Replace the live (happy-dom-unreliable) cross-block DOM selection with a
// constructed `ISelection` that the real `cutHandler` consumes. The block tree
// and every mutation remain real; only the selection read is stubbed.
function stubSelection(
    muya: Muya,
    a: Content,
    aOff: number,
    f: Content,
    fOff: number,
    direction = SelectionDirection.Forward,
) {
    const aPath = a.path;
    const fPath = f.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: aOff, block: a, path: aPath },
        focus: { offset: fOff, block: f, path: fPath },
        isCollapsed: false,
        isSelectionInSameBlock: a === f,
        direction,
        type: SelectionCaretType.Range,
    });
}

// json state applies composed ops on a requestAnimationFrame; wait for the
// authoritative markdown to settle.
async function cutAndRead(muya: Muya): Promise<string> {
    muya.editor.clipboard.cutHandler();
    await new Promise(r => setTimeout(r, 40));
    return muya.getMarkdown();
}

describe('track C — cross-block cut keeps both endpoint tails (leaf merge)', () => {
    it('paragraph -> list item: tail of the list item survives', async () => {
        const muya = bootMuya('hello\n\n- world item\n');
        const blocks = contentBlocks(muya);
        // 'hello'@2 -> 'he' merged with 'world item'@3 -> 'ld item'.
        stubSelection(muya, blocks[0], 2, blocks[blocks.length - 1], 3);
        expect(await cutAndRead(muya)).toBe('held item\n');
    });

    it('list item -> paragraph: start stays a list item, both tails kept', async () => {
        const muya = bootMuya('- list one\n\nparagraph two\n');
        const blocks = contentBlocks(muya);
        stubSelection(muya, blocks[0], 2, blocks[blocks.length - 1], 4);
        expect(await cutAndRead(muya)).toBe('- ligraph two\n');
    });

    it('paragraph -> block quote: quote tail survives', async () => {
        const muya = bootMuya('hello\n\n> quoted text\n');
        const blocks = contentBlocks(muya);
        stubSelection(muya, blocks[0], 2, blocks[blocks.length - 1], 3);
        expect(await cutAndRead(muya)).toBe('heted text\n');
    });

    it('block quote -> paragraph: start stays a quote, both tails kept', async () => {
        const muya = bootMuya('> quoted text\n\nhello\n');
        const blocks = contentBlocks(muya);
        stubSelection(muya, blocks[0], 2, blocks[blocks.length - 1], 3);
        expect(await cutAndRead(muya)).toBe('> qulo\n');
    });

    it('paragraph -> code block: code tail merges into the paragraph', async () => {
        const muya = bootMuya('hello\n\n```\ncodeline\n```\n');
        const blocks = contentBlocks(muya);
        // The code body content leaf is the LAST content leaf (the
        // language-input leaf comes before it).
        const codeContent = blocks[blocks.length - 1];
        // 'hello'@2 -> 'he' merged with 'codeline'@4 -> 'line'.
        stubSelection(muya, blocks[0], 2, codeContent, 4);
        expect(await cutAndRead(muya)).toBe('heline\n');
    });

    it('code block -> paragraph: start stays a code block, both tails kept', async () => {
        const muya = bootMuya('```\ncodeline\n```\n\nhello\n');
        const blocks = contentBlocks(muya);
        // blocks: [language-input '', codeblock.content 'codeline', paragraph 'hello'].
        const codeContent = blocks.find(b => b.blockName === 'codeblock.content')!;
        const para = blocks[blocks.length - 1];
        // 'codeline'@2 -> 'co' merged with 'hello'@3 -> 'lo'.
        stubSelection(muya, codeContent, 2, para, 3);
        expect(await cutAndRead(muya)).toBe('```\ncolo\n```\n');
    });

    it('list item -> list item: middle item gone, tails merged', async () => {
        const muya = bootMuya('- one item\n- two item\n- three item\n');
        const blocks = contentBlocks(muya);
        // 'one item'@2 -> 'on' merged with 'three item'@3 -> 'ee item'.
        stubSelection(muya, blocks[0], 2, blocks[2], 3);
        expect(await cutAndRead(muya)).toBe('- onee item\n');
    });

    it('list item -> sibling list item (adjacent): tails merged into one item', async () => {
        const muya = bootMuya('- one item\n- two item\n');
        const blocks = contentBlocks(muya);
        // 'one item'@2 -> 'on' merged with 'two item'@3 -> ' item'.
        stubSelection(muya, blocks[0], 2, blocks[1], 3);
        expect(await cutAndRead(muya)).toBe('- on item\n');
    });

    it('paragraph -> paragraph across an intervening block: middle removed', async () => {
        const muya = bootMuya('alpha\n\nbeta\n\ngamma\n');
        const blocks = contentBlocks(muya);
        stubSelection(muya, blocks[0], 2, blocks[2], 2);
        expect(await cutAndRead(muya)).toBe('almma\n');
    });

    it('cut is the engine behind typing-replace on a cross-block selection', async () => {
        // The paste/typing path calls cutHandler first to collapse the range;
        // the result must be the merged single block ready to receive input.
        const muya = bootMuya('foo\n\nbar\n');
        const blocks = contentBlocks(muya);
        stubSelection(muya, blocks[0], 1, blocks[1], 2);
        expect(await cutAndRead(muya)).toBe('fr\n');
    });

    it('paragraph -> table cell: grid is preserved, spanned cells emptied', async () => {
        const muya = bootMuya('hello\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n');
        const blocks = contentBlocks(muya);
        const firstCell = blocks.find(
            b => b.blockName === 'table.cell.content' && b.text === 'a',
        )!;
        // 'hello'@2 -> 'he'; the table survives with cell 'a' emptied.
        stubSelection(muya, blocks[0], 2, firstCell, 1);
        const md = await cutAndRead(muya);
        expect(md).toContain('he\n');
        expect(md).toContain('| b'); // the rest of the grid survives
        expect(md).toContain('| 1'); // body row untouched
        expect(md).not.toMatch(/\|\s*a\s*\|/); // cell 'a' is now empty
    });

    it('table cell -> paragraph: start cell keeps the merge, grid preserved', async () => {
        const muya = bootMuya('| a | b |\n| --- | --- |\n| 1 | 2 |\n\nhello\n');
        const blocks = contentBlocks(muya);
        const firstCell = blocks.find(
            b => b.blockName === 'table.cell.content' && b.text === 'a',
        )!;
        const para = blocks[blocks.length - 1];
        // cell 'a'@0 -> '' merged with 'hello'@3 -> 'lo'.
        stubSelection(muya, firstCell, 0, para, 3);
        const md = await cutAndRead(muya);
        expect(md).toMatch(/\|\s*lo\s*\|/); // merged into the start cell
        expect(md).toContain('| b'); // grid intact
        expect(md).not.toContain('hello');
    });

    it('paragraph -> first list item keeps the later items', async () => {
        const muya = bootMuya('hello\n\n- x item\n- y item\n- z item\n');
        const blocks = contentBlocks(muya);
        // end = first list item 'x item'@2 -> 'item'; items y/z survive.
        stubSelection(muya, blocks[0], 2, blocks[1], 2);
        expect(await cutAndRead(muya)).toBe('heitem\n\n- y item\n- z item\n');
    });

    it('cell -> cell in the same table: grid kept, spanned cells emptied', async () => {
        const muya = bootMuya('| a | b |\n| --- | --- |\n| 1 | 2 |\n');
        const blocks = contentBlocks(muya);
        const cellA = blocks.find(b => b.text === 'a')!;
        const cell2 = blocks.find(b => b.text === '2')!;
        // 'a'@1 -> 'a' merged with '2'@0 -> '2'; cells between emptied.
        stubSelection(muya, cellA, 1, cell2, 0);
        const md = await cutAndRead(muya);
        // Two-column, two-row grid survives.
        expect(md.match(/\| --- \| --- \|/g)?.length).toBe(1);
        expect(md).toMatch(/\|\s*a2\s*\|/);
        expect(md).not.toMatch(/\|\s*b\s*\|/); // 'b' emptied
        expect(md).not.toMatch(/\|\s*1\s*\|/); // '1' emptied
    });

    it('places the caret at the start block / start offset after the cut', async () => {
        const muya = bootMuya('hello\n\n- world item\n');
        const blocks = contentBlocks(muya);
        const start = blocks[0];
        stubSelection(muya, start, 2, blocks[blocks.length - 1], 3);
        muya.editor.clipboard.cutHandler();
        await new Promise(r => setTimeout(r, 40));
        // The caret is seated on the merged start block at the cut offset. The
        // happy-dom native selection does not round-trip, so assert on the
        // engine selection state that `setCursor` writes directly.
        const { selection } = muya.editor;
        expect(muya.editor.activeContentBlock).toBe(start);
        expect(muya.editor.activeContentBlock?.text).toBe('held item');
        expect(selection.anchor?.offset).toBe(2);
        expect(selection.focus?.offset).toBe(2);
    });
});

describe('track C — whole-document selection collapses to one empty paragraph', () => {
    it('select-all then cut leaves a single empty paragraph', async () => {
        const muya = bootMuya('# Title\n\nbody text\n\n- a\n- b\n');
        const blocks = contentBlocks(muya);
        const first = blocks[0];
        const last = blocks[blocks.length - 1];
        stubSelection(muya, first, 0, last, last.text.length);
        expect(await cutAndRead(muya)).toBe('\n');
    });

    it('select-all over a single paragraph collapses to empty', async () => {
        const muya = bootMuya('just one line\n');
        const blocks = contentBlocks(muya);
        // Single block, but the whole text is selected (anchor !== focus block
        // is false here) — exercise via the cross-block-style whole selection.
        const only = blocks[0];
        stubSelection(muya, only, 0, only, only.text.length);
        expect(await cutAndRead(muya)).toBe('\n');
    });
});

// Drive a real frozen table selection through DOM mouse events (same pattern
// as selection/__tests__/TableRectSelection.spec.ts) so `cutHandler`'s table
// branch reads a genuine selection.
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

function dragSelect(table: TableBlock, r1: number, c1: number, r2: number, c2: number): void {
    fireMouse(cellDom(table, r1, c1), 'mousedown');
    fireMouse(cellDom(table, r2, c2), 'mousemove');
    fireMouse(cellDom(table, r2, c2), 'mouseup');
}

async function cutSelectionAndRead(muya: Muya): Promise<string> {
    muya.editor.clipboard.cutHandler();
    await new Promise(r => setTimeout(r, 40));
    return muya.getMarkdown();
}

describe('track C — empty table row/column/whole-table cut is structural', () => {
    it('cutting an already-empty whole column removes that column', async () => {
        // 3-column table whose middle column is entirely empty.
        const muya = bootMuya(
            '| a1 |  | c1 |\n| --- | --- | --- |\n| a2 |  | c2 |\n| a3 |  | c3 |\n',
        );
        const table = firstTable(muya);
        dragSelect(table, 0, 1, 2, 1); // whole middle column (all 3 rows)
        const md = await cutSelectionAndRead(muya);
        // The empty middle column is gone; the table now has 2 columns.
        expect(md).toContain('a1');
        expect(md).toContain('c1');
        expect(table.columnCount).toBe(2);
    });

    it('cutting an already-empty whole row removes that row', async () => {
        // 4 body rows; the LAST body row is entirely empty.
        const muya = bootMuya(
            '| a1 | b1 |\n| --- | --- |\n| a2 | b2 |\n|  |  |\n',
        );
        const table = firstTable(muya);
        const before = table.rowCount;
        dragSelect(table, before - 1, 0, before - 1, 1); // whole empty last row
        await cutSelectionAndRead(muya);
        expect(table.rowCount).toBe(before - 1);
    });

    it('cutting an empty whole table removes the table block', async () => {
        const muya = bootMuya(
            '|  |  |\n| --- | --- |\n|  |  |\n',
        );
        const table = firstTable(muya);
        dragSelect(table, 0, 0, table.rowCount - 1, table.columnCount - 1);
        const md = await cutSelectionAndRead(muya);
        expect(md).not.toContain('|');
    });

    it('cutting a selection that still has content only empties in place', async () => {
        const muya = bootMuya(
            '| a1 | b1 |\n| --- | --- |\n| a2 | b2 |\n',
        );
        const table = firstTable(muya);
        const beforeRows = table.rowCount;
        const beforeCols = table.columnCount;
        dragSelect(table, 0, 0, 1, 1); // has content
        const md = await cutSelectionAndRead(muya);
        // Structure unchanged; only the cells were emptied.
        expect(table.rowCount).toBe(beforeRows);
        expect(table.columnCount).toBe(beforeCols);
        expect(md).not.toMatch(/\ba1\b/);
        expect(md).not.toMatch(/\bb2\b/);
    });
});
