import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { Nullable } from '../types';
import type Clipboard from './index';
import Format from '../block/base/format';
import { ScrollPage } from '../block/scrollPage';
import { CLASS_NAMES } from '../config';
import { SelectionDirection, SelectionType } from '../selection/types';
import { getBlock } from '../utils/dom';

/**
 * Whole-document selection predicate: the selection spans from the very first
 * content leaf at offset 0 to the very last content leaf at its end.
 */
function isSelectAll(
    clipboard: Clipboard,
    startBlock: Content,
    startOffset: number,
    endBlock: Content,
    endOffset: number,
): boolean {
    const firstContent = clipboard.scrollPage?.firstContentInDescendant();
    const lastContent = clipboard.scrollPage?.lastContentInDescendant();

    return (
        firstContent === startBlock
        && startOffset === 0
        && lastContent === endBlock
        && endOffset === endBlock.text.length
    );
}

/**
 * Replace the whole document with a single empty paragraph and seat the
 * caret in it.
 */
function resetToEmptyParagraph(clipboard: Clipboard): void {
    const { scrollPage } = clipboard;
    if (scrollPage == null)
        return;

    scrollPage.forEach((child) => {
        (child as Parent).remove();
    });

    const newParagraphBlock = ScrollPage.loadBlock('paragraph').create(
        clipboard.muya,
        { name: 'paragraph', text: '' },
    );
    scrollPage.append(newParagraphBlock, 'user');

    const cursorBlock = newParagraphBlock.firstContentInDescendant();
    cursorBlock?.setCursor(0, 0, true);
}

// Seat the caret and re-evaluate the block's type from its new text — a cut can
// add or remove a block-leading marker (`# `, `- `, …).
function setCursorAndConvert(block: Content, offset: number): void {
    block.setCursor(offset, offset, true);
    if (block instanceof Format)
        block.checkInlineUpdate();
}

// Collapse the document to a single empty paragraph once a cut empties it.
function resetIfEmpty(clipboard: Clipboard): void {
    if (clipboard.scrollPage?.length() === 0)
        resetToEmptyParagraph(clipboard);
}

// Empty every cell content leaf from `start` up to and including `after`,
// keeping the table grid intact.
function emptyCellContentsUntil(
    start: Nullable<Content>,
    after: TreeNode,
): void {
    let cellContent = start;
    while (cellContent) {
        if (cellContent.text !== '')
            cellContent.text = '';

        if (cellContent === after)
            break;

        cellContent = cellContent.nextContentInContext();
    }
}

function removeBlocksWithinTable(before: TreeNode, after: TreeNode): void {
    emptyCellContentsUntil(before.nextContentInContext(), after);
}

/**
 * Handle a cross-block cut whose end lands inside a table. The table grid is
 * exempt from structural removal: remove
 * the outmost blocks strictly between `before` and the table, then empty —
 * not remove — every cell from the table's first cell up to and including
 * `after`'s cell.
 */
function removeBlocksIntoTable(
    before: TreeNode,
    after: TreeNode,
    table: Parent,
): void {
    const beforeOutMost = before.outMostBlock;

    // Remove every outmost block strictly between `before`'s outmost block
    // and the table.
    if (beforeOutMost != null) {
        let between: Nullable<TreeNode> = beforeOutMost.next;
        while (between && between !== table) {
            const temp = between.next;
            between.remove();
            between = temp;
        }
    }

    // Empty the cell content leaves from the table start through `after`'s
    // cell, keeping the grid intact.
    emptyCellContentsUntil(table.firstContentInDescendant(), after);
}

function removePrecedingSiblings(node: TreeNode): void {
    let prev = node.prev;
    while (prev) {
        const temp = prev.prev;
        prev.remove();
        prev = temp;
    }
}

// `after`'s branch is removed but later siblings inside `afterBranch` survive.
// Walk up from `after` to the direct child of `afterBranch`, removing each
// on-path node's preceding siblings and any ancestor it leaves empty, stopping
// below `afterBranch`. Finally remove the on-path direct child itself; later
// siblings survive.
function pruneAfterBranch(afterBranch: TreeNode, after: TreeNode): void {
    let onPath: TreeNode = after;
    while (onPath.parent && onPath.parent !== afterBranch) {
        removePrecedingSiblings(onPath);
        const parent = onPath.parent;
        onPath.remove();
        if (parent.children.length > 0)
            return;

        onPath = parent;
    }

    removePrecedingSiblings(onPath);
    onPath.remove();
}

/**
 * Remove the document-order span between the `before` content leaf and the
 * `after` content leaf — every block strictly between them, plus `after`
 * and any container `after` leaves empty — while preserving `before`'s
 * container chain and any block that follows `after`. Equivalent to legacy
 * `contentState.removeBlocks(before, after)` (`before`'s head + `after`'s
 * tail already live in `before.text`).
 *
 * Nodes are removed children-before-parents so each dispatched json removal
 * targets a still-attached path.
 */
function removeBlocks(before: TreeNode, after: TreeNode): void {
    // A table is exempt from structural removal: empty the spanned cells in
    // place and keep the grid rather than deleting cells/rows.
    const beforeTable = before.closestBlock('table');
    const afterTable = after.closestBlock('table');

    if (beforeTable != null && beforeTable === afterTable) {
        removeBlocksWithinTable(before, after);

        return;
    }

    // `after` lands inside a table that does not also contain `before`:
    // remove only the blocks between `before` and the table, then empty the
    // spanned cells.
    if (afterTable != null) {
        removeBlocksIntoTable(before, after, afterTable as Parent);

        return;
    }

    const beforeAncestors = new Set<TreeNode>();
    for (let node: Nullable<TreeNode> = before; node; node = node.parent)
        beforeAncestors.add(node);

    // The shared container: the lowest ancestor of `after` that also
    // contains `before`.
    let afterBranch: TreeNode = after;
    while (
        afterBranch.parent
        && !afterBranch.parent.isScrollPage
        && !beforeAncestors.has(afterBranch.parent)
    ) {
        afterBranch = afterBranch.parent;
    }

    const commonParent = afterBranch.parent;
    const beforeBranch = commonParent
        ? [...beforeAncestors].find(node => node.parent === commonParent)
        : null;

    // Remove every sibling strictly between `beforeBranch` and
    // `afterBranch` inside the shared container.
    let between = beforeBranch ? beforeBranch.next : afterBranch.prev;
    while (between && between !== afterBranch) {
        const temp = between.next;
        between.remove();
        between = temp;
    }

    // Does any content leaf after `after` survive inside `afterBranch`? If
    // not, `afterBranch` is fully consumed — remove it once (this also keeps
    // atomic blocks like code/math/html/diagram/frontmatter, whose inner
    // tree collapses to a single json node, from being double-removed).
    const nextContent = after.nextContentInContext();
    const afterHasSurvivors
        = nextContent != null && nextContent.isInBlock(afterBranch as Parent);

    if (!afterHasSurvivors) {
        if (afterBranch.parent)
            afterBranch.remove();

        return;
    }

    pruneAfterBranch(afterBranch, after);
}

/**
 * Resolve the frozen table selection to its table and the list of selected
 * body cells, reading the highlighted cell DOM nodes. Returns `null` when
 * there is no resolvable selection.
 */
function selectedTableCells(
    clipboard: Clipboard,
): Nullable<{ table: Table; cells: TableBodyCell[] }> {
    const { domNode } = clipboard.muya;
    const selectedDoms = domNode.querySelectorAll(`.${CLASS_NAMES.MU_TABLE_CELL_SELECTED}`);
    const cells: TableBodyCell[] = [];
    let table: Nullable<Table> = null;

    for (const dom of selectedDoms) {
        const block = getBlock(dom);
        if (block == null || block.blockName !== 'table.cell')
            continue;

        const cell = block as TableBodyCell;
        cells.push(cell);
        table ??= cell.table;
    }

    if (table == null || cells.length === 0)
        return null;

    return { table, cells };
}

// Remove the whole table block and seat the caret just outside it (or reset to
// a single empty paragraph when the table was the only block).
function removeWholeTable(clipboard: Clipboard, table: Table): void {
    clipboard.selection.table.clear();
    const outsideContent
        = table.nextContentInContext() ?? table.previousContentInContext();
    table.remove();
    if (clipboard.scrollPage?.length() === 0)
        resetToEmptyParagraph(clipboard);
    else
        outsideContent?.setCursor(0, 0, true);
}

// For an already-empty frozen selection: if the rectangle covers whole
// column(s), whole row(s), or the whole table, delete that structure and return
// `true`; a partial rectangle returns `false` so the caller just drops the
// selection. Multiple whole columns / rows are removed high-index-first so the
// remaining offsets stay valid.
function removeEmptyTableStructure(clipboard: Clipboard): boolean {
    const selectedCells = selectedTableCells(clipboard);
    if (selectedCells == null)
        return false;

    const { table, cells } = selectedCells;
    const rows = new Set(cells.map(cell => cell.rowOffset));
    const columns = new Set(cells.map(cell => cell.columnOffset));
    const spansAllRows = rows.size === table.rowCount;
    const spansAllColumns = columns.size === table.columnCount;

    if (spansAllRows && spansAllColumns) {
        removeWholeTable(clipboard, table);

        return true;
    }

    if (spansAllRows) {
        clipboard.selection.table.clear();
        let cursorBlock: Nullable<Content> = null;
        for (const column of [...columns].sort((a, b) => b - a))
            cursorBlock = table.removeColumn(column);
        cursorBlock?.setCursor(0, 0, true);

        return true;
    }

    if (spansAllColumns) {
        clipboard.selection.table.clear();
        let cursorBlock: Nullable<Content> = null;
        for (const row of [...rows].sort((a, b) => b - a))
            cursorBlock = table.removeRow(row);
        cursorBlock?.setCursor(0, 0, true);

        return true;
    }

    return false;
}

// Clipboard cut over a frozen table selection: a whole-table selection is
// deleted even with content; otherwise content cells fall back to an in-place
// clear, and an empty whole column/row selection deletes that structure.
function cutTableStructure(clipboard: Clipboard): boolean {
    const selectedCells = selectedTableCells(clipboard);
    if (selectedCells == null)
        return false;

    const { table, cells } = selectedCells;
    const rows = new Set(cells.map(cell => cell.rowOffset));
    const columns = new Set(cells.map(cell => cell.columnOffset));

    if (rows.size === table.rowCount && columns.size === table.columnCount) {
        removeWholeTable(clipboard, table);

        return true;
    }

    if (cells.some(cell => (cell.firstChild as Content)?.text))
        return false;

    return removeEmptyTableStructure(clipboard);
}

export function cutSelection(clipboard: Clipboard): void {
    // Cut a selected image: the copy half wrote its raw markdown; remove it here.
    const selectedImage = clipboard.selection.image;
    if (selectedImage) {
        const { block, ...imageInfo } = selectedImage;
        block.deleteImage(imageInfo);
        clipboard.selection.activate(SelectionType.TEXT);

        return;
    }

    if (clipboard.selection.table.hasSelection) {
        if (!cutTableStructure(clipboard))
            clipboard.selection.table.clearSelectedCells();

        return;
    }

    const selection = clipboard.selection.getSelection();
    if (selection == null)
        return;

    const {
        isSelectionInSameBlock,
        anchor,
        focus,
        direction,
    } = selection;
    const anchorBlock = anchor.block;
    const focusBlock = focus.block;

    // Handler `cut` event in the same block.
    if (isSelectionInSameBlock) {
        const { text } = anchorBlock;
        const startOffset
            = direction === SelectionDirection.FORWARD ? anchor.offset : focus.offset;
        const endOffset = direction === SelectionDirection.FORWARD ? focus.offset : anchor.offset;

        anchorBlock.text
            = text.substring(0, startOffset) + text.substring(endOffset);

        setCursorAndConvert(anchorBlock, startOffset);

        return;
    }

    const startBlock = direction === SelectionDirection.FORWARD ? anchorBlock : focusBlock;
    const endBlock = direction === SelectionDirection.FORWARD ? focusBlock : anchorBlock;
    const startOffset = direction === SelectionDirection.FORWARD ? anchor.offset : focus.offset;
    const endOffset = direction === SelectionDirection.FORWARD ? focus.offset : anchor.offset;

    // Whole-document selection collapses to a single empty paragraph.
    if (isSelectAll(clipboard, startBlock, startOffset, endBlock, endOffset)) {
        resetToEmptyParagraph(clipboard);

        return;
    }

    // #918: a cross-block cut that starts inside a code fence's language line
    // collapses the start code block to a paragraph holding the merged text,
    // rather than corrupting the code block's language with the merged content.
    if (startBlock.blockName === 'language-input') {
        collapseLanguageInputCut(clipboard, startBlock, endBlock, startOffset, endOffset);

        return;
    }

    // Leaf-level merge: keep the
    // start head and the end tail in the start content block, then remove
    // only the structure strictly between the two leaves (and the emptied
    // end-side containers). The start block keeps its container — a list
    // item stays a list item, a quote stays a quote.
    startBlock.text
        = startBlock.text.substring(0, startOffset)
            + endBlock.text.substring(endOffset);

    removeBlocks(startBlock, endBlock);

    setCursorAndConvert(startBlock, startOffset);
    resetIfEmpty(clipboard);
}

// #918: collapse the start code block (whose language line begins the
// selection) into a paragraph carrying the merged head + end-tail text, then
// remove the spanned structure.
function collapseLanguageInputCut(
    clipboard: Clipboard,
    startBlock: Content,
    endBlock: Content,
    startOffset: number,
    endOffset: number,
): void {
    const mergedText
        = startBlock.text.substring(0, startOffset)
            + endBlock.text.substring(endOffset);
    const codeBlock = startBlock.outMostBlock;

    removeBlocks(startBlock, endBlock);

    const paragraph = ScrollPage.loadBlock('paragraph').create(clipboard.muya, {
        name: 'paragraph',
        text: mergedText,
    });
    codeBlock?.replaceWith(paragraph);

    paragraph.firstContentInDescendant()?.setCursor(startOffset, startOffset, true);

    resetIfEmpty(clipboard);
}

// Keyboard delete over a frozen table selection (two-stage, muyajs parity):
// the first press clears the selected cells' text but keeps the rectangle
// frozen; once the cells are empty, the next press removes whole column(s) /
// row(s) / the whole table, or drops the selection for a partial rectangle.
export function deleteTableSelection(clipboard: Clipboard): void {
    if (clipboard.selection.table.emptySelectedCells())
        return;

    if (!removeEmptyTableStructure(clipboard))
        clipboard.selection.table.clear();
}
