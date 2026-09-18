// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// A cross-block cut that ends inside a table:
// #5400 removed every block after the block where the selection starts when the
//       table was inside a list item or a quote;
// #5399 kept the rest of the list the selection starts in;
// #5405 moved the unselected text of the end cell out of the table, and left a
//       fully selected table behind as an empty grid;
// #5398 left the emptied cells showing their old text.

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

function contentBlocks(muya: Muya): Content[] {
    const blocks: Content[] = [];
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block) {
        blocks.push(block);
        block = block.nextContentInContext() ?? null;
    }
    return blocks;
}

function findContent(muya: Muya, text: string): Content {
    const block = contentBlocks(muya).find(b => b.text === text);
    if (!block)
        throw new Error(`no content leaf with text ${JSON.stringify(text)}`);
    return block;
}

// Every content leaf in document order, as `blockName:text`.
function outline(muya: Muya): string[] {
    return contentBlocks(muya).map(block => `${block.blockName}:${block.text}`);
}

function topLevelNames(muya: Muya): string[] {
    const names: string[] = [];
    muya.editor.scrollPage!.forEach(block => names.push(block.blockName));
    return names;
}

function cut(muya: Muya, anchor: Content, anchorOffset: number, focus: Content, focusOffset: number): void {
    const anchorPath = anchor.path;
    const focusPath = focus.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: anchorOffset, block: anchor, path: anchorPath },
        focus: { offset: focusOffset, block: focus, path: focusPath },
        isCollapsed: false,
        isSelectionInSameBlock: false,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
    muya.editor.clipboard.cutHandler();
}

// The json state still matches the block tree.
function expectNoDrift(muya: Muya): void {
    muya.editor.jsonState.flush();
    const tree: TState[] = [];
    muya.editor.scrollPage!.forEach(block => tree.push((block as Parent).getState()));
    expect(muya.editor.jsonState.getState()).toEqual(tree);
}

describe('cross-block cut ending in a table', () => {
    it('keeps the blocks after the list the table is nested in (#5400)', () => {
        const muya = bootMuya('- a\n\n  | h |\n  | --- |\n  | 1 |\n\nafter\n\nmore\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, '1'), 0);

        expect(outline(muya)).toEqual([
            'paragraph.content:a',
            'table.cell.content:',
            'table.cell.content:1',
            'paragraph.content:after',
            'paragraph.content:more',
        ]);
        expectNoDrift(muya);
    });

    it('keeps the quote holding the table and the blocks after it (#5400)', () => {
        const muya = bootMuya('- a\n\n> | h |\n> | --- |\n> | 1 |\n\nafter\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, '1'), 0);

        expect(topLevelNames(muya)).toEqual(['bullet-list', 'block-quote', 'paragraph']);
        expect(outline(muya)).toEqual([
            'paragraph.content:a',
            'table.cell.content:',
            'table.cell.content:1',
            'paragraph.content:after',
        ]);
        expectNoDrift(muya);
    });

    it('removes the rest of the list before the table and keeps the unselected cell text (#5399, #5405)', () => {
        const muya = bootMuya('- a\n- b\n\n| h |\n| --- |\n| 12 |\n| 34 |\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, '12'), 1);

        expect(outline(muya)).toEqual([
            'paragraph.content:a',
            'table.cell.content:',
            'table.cell.content:2',
            'table.cell.content:34',
        ]);
        expectNoDrift(muya);
    });

    it('removes a table that lies entirely inside the selection (#5405)', () => {
        const muya = bootMuya('- a\n\n| h |\n| --- |\n| 1 |\n\ntail\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, '1'), 1);

        expect(topLevelNames(muya)).toEqual(['bullet-list', 'paragraph']);
        expect(outline(muya)).toEqual(['paragraph.content:a', 'paragraph.content:tail']);
        expectNoDrift(muya);
    });

    it('removes the quote a fully selected table leaves empty (#5405)', () => {
        const muya = bootMuya('- a\n\n> | h |\n> | --- |\n> | 1 |\n\ntail\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, '1'), 1);

        expect(topLevelNames(muya)).toEqual(['bullet-list', 'paragraph']);
        expectNoDrift(muya);
    });

    it('shows the emptied cells as empty (#5398)', () => {
        const muya = bootMuya('- a\n\n| h |\n| --- |\n| 1 |\n\ntail\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, '1'), 0);

        const cells = contentBlocks(muya).filter(block => block.blockName === 'table.cell.content');
        expect(cells.map(cell => cell.text)).toEqual(['', '1']);
        expect(cells.map(cell => cell.domNode!.textContent)).toEqual(['', '1']);
        expectNoDrift(muya);
    });

    it('shows the cells a cut inside one table empties as empty (#5398)', () => {
        const muya = bootMuya('| a1 | b1 |\n| --- | --- |\n| c1 | d1 |\n');

        // Both ends in one table: the end cell's tail joins the start cell and
        // the spanned cells are emptied, as before.
        cut(muya, findContent(muya, 'a1'), 1, findContent(muya, 'd1'), 1);

        const cells = contentBlocks(muya).filter(block => block.blockName === 'table.cell.content');
        expect(cells.map(cell => cell.text)).toEqual(['a1', '', '', '']);
        expect(cells.map(cell => cell.domNode!.textContent)).toEqual(['a1', '', '', '']);
        expectNoDrift(muya);
    });

    it('removes a table the selection passes over', () => {
        const muya = bootMuya('- a\n\n| h |\n| --- |\n| 1 |\n\ntail\n');

        cut(muya, findContent(muya, 'a'), 1, findContent(muya, 'tail'), 1);

        expect(topLevelNames(muya)).toEqual(['bullet-list']);
        expect(outline(muya)).toEqual(['paragraph.content:aail']);
        expectNoDrift(muya);
    });
});
