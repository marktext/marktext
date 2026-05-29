// @vitest-environment happy-dom
import type Parent from '../../../block/base/parent';
import { describe, expect, it } from 'vitest';
import { canTurnIntoMenu } from '../config';

// Regression for marktext commit 7b7a9424 "should not nest math block into
// other math block (#1153)".
//
// In marktext, `insertContainerBlock(functionType, block)` walked from the
// caret block up to the paragraph and replaced it with a new container
// (math/html/code/diagram). When the caret was already inside another
// container (e.g. inside a math-block's code line), the old code happily
// constructed a NEW container at the wrong level — yielding a math-block
// nested inside a math-block. The marktext fix added `getAnchor(block)` +
// "if no anchor, abort" + "don't remove the block when not a paragraph".
//
// New muya has no `insertContainerBlock`. All math-block / html-block /
// code-block / diagram creation flows are gated to paragraph blocks:
//   • `ParagraphFrontMenu.canTurnIntoMenu(block)` returns `[]` for any
//     non-paragraph container, so the user can't open the "turn into"
//     submenu from inside a math/code/html/diagram block at all.
//   • `ParagraphQuickInsertMenu` only fires on `paragraph.content`
//     (`block.blockName !== 'paragraph.content' return;`) and only when the
//     anchorBlock is `instanceof ParagraphContent`. Inside a math-block
//     you're in a `codeblock.content`, not `paragraph.content`, so the menu
//     never opens — `/math` can't reach `replaceBlockByLabel`.
//   • `ParagraphContent._enterConvert` is the auto-convert for `$$` and is
//     only reachable from paragraph enterHandler.
//
// These tests pin the front-menu gate. The quick-insert + enter-convert
// gates are at the listen() level and out of unit-test reach without a
// full Muya bootstrap, but the front-menu gate is enough to demonstrate
// that the user has no UI path to nest a math-block inside a math-block.

// `canTurnIntoMenu` only reads `blockName` and `firstContentInDescendant()`
// on the passed-in block; the structural fake covers that surface.
function fakeBlock(blockName: string, paragraphText: string = ''): Parent {
    return {
        blockName,
        firstContentInDescendant() {
            return { text: paragraphText };
        },
    } as unknown as Parent;
}

describe('canTurnIntoMenu — no nesting math/code/html/diagram inside themselves (marktext 7b7a9424)', () => {
    it('returns [] for a math-block (front menu shows no turn-into list)', () => {
        expect(canTurnIntoMenu(fakeBlock('math-block'))).toEqual([]);
    });

    it('returns [] for an html-block', () => {
        expect(canTurnIntoMenu(fakeBlock('html-block'))).toEqual([]);
    });

    it('returns [] for a code-block', () => {
        expect(canTurnIntoMenu(fakeBlock('code-block'))).toEqual([]);
    });

    it('returns [] for a diagram block', () => {
        expect(canTurnIntoMenu(fakeBlock('diagram'))).toEqual([]);
    });

    it('returns [] for a table block (turning a table into math would also crash)', () => {
        expect(canTurnIntoMenu(fakeBlock('table'))).toEqual([]);
    });

    it('still offers conversion for a paragraph (sanity — gate is selective)', () => {
        const items = canTurnIntoMenu(fakeBlock('paragraph', ''));
        // Empty paragraph: all menu items except frontmatter; non-empty
        // paragraph: only paragraph/heading/quote/list. Both must be > 0.
        expect(items.length).toBeGreaterThan(0);
        // Both an empty paragraph and a typed paragraph must keep
        // math-block reachable via SOME paragraph path (the
        // `paragraphIsEmpty` branch returns ALL except frontmatter,
        // including math-block).
        const emptyItems = canTurnIntoMenu(fakeBlock('paragraph', ''));
        expect(emptyItems.some((i: { label: string }) => i.label === 'math-block')).toBe(true);
    });

    it('non-empty paragraph offers no math-block turn-into (only inline/list types)', () => {
        // The non-empty branch filters down to paragraph/atx-heading/
        // block-quote/list — math-block is intentionally excluded so a
        // half-typed paragraph can't auto-jump into a math container.
        const items = canTurnIntoMenu(fakeBlock('paragraph', 'hello world'));
        expect(items.some((i: { label: string }) => i.label === 'math-block')).toBe(false);
    });
});

// Regression for marktext commit f00da152 (#812 — "insert table into `table`,
// `html`, `code`, `math` block will cause wrong markdown syntax"). The bug:
// `createFigure` was reachable from inside non-paragraph blocks; the new
// `<figure><table/></figure>` ended up nested inside another table cell or
// code-block content, producing garbage markdown that subsequently
// crashed on re-parse. marktext's fix added `getAnchor(block)` + "abort if
// no anchor" gating.
//
// New muya gates the same way at the UI layer: `canTurnIntoMenu` returns
// `[]` for table/html-block/code-block/math-block/diagram, so the front
// menu never offers "turn into table" from those contexts. The quick-insert
// `/table` shortcut likewise only fires on `paragraph.content`. The cases
// already locked above (math-block, html-block, code-block, diagram, table)
// also cover this commit — a single gate keeps both 7b7a9424 and f00da152
// off the UI.

describe('canTurnIntoMenu — no inserting tables inside non-paragraph containers (marktext f00da152)', () => {
    it('returns [] for math-block (cannot offer turn-into-table)', () => {
        const items = canTurnIntoMenu(fakeBlock('math-block'));
        expect(items.some((i: { label: string }) => i.label === 'table')).toBe(false);
    });

    it('returns [] for html-block (cannot offer turn-into-table)', () => {
        const items = canTurnIntoMenu(fakeBlock('html-block'));
        expect(items.some((i: { label: string }) => i.label === 'table')).toBe(false);
    });

    it('returns [] for code-block (cannot offer turn-into-table)', () => {
        const items = canTurnIntoMenu(fakeBlock('code-block'));
        expect(items.some((i: { label: string }) => i.label === 'table')).toBe(false);
    });

    it('returns [] for table (cannot offer turn-into-table on a table)', () => {
        const items = canTurnIntoMenu(fakeBlock('table'));
        expect(items.some((i: { label: string }) => i.label === 'table')).toBe(false);
    });

    it('empty paragraph DOES include table — sanity that the gate is positive elsewhere', () => {
        const items = canTurnIntoMenu(fakeBlock('paragraph', ''));
        expect(items.some((i: { label: string }) => i.label === 'table')).toBe(true);
    });

    it('non-empty paragraph excludes table from the turn-into list', () => {
        const items = canTurnIntoMenu(fakeBlock('paragraph', 'typed text'));
        expect(items.some((i: { label: string }) => i.label === 'table')).toBe(false);
    });
});
