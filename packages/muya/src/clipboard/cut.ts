import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type { Nullable } from '../types';
import type Clipboard from './index';
import { ScrollPage } from '../block/scrollPage';
import { CLASS_NAMES } from '../config';
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

/**
 * Structurally delete an empty whole row / column / table when cutting a
 * frozen table-cell selection. Returns `true` when it handled the cut (the
 * caller then skips the in-place clear), `false` to fall through to the
 * in-place clear.
 */
function cutEmptyTableStructure(clipboard: Clipboard): boolean {
    const selectedCells = selectedTableCells(clipboard);
    if (selectedCells == null)
        return false;

    const { table, cells } = selectedCells;
    const hasContent = cells.some(cell => (cell.firstChild as Content)?.text);
    if (hasContent)
        return false;

    const rows = new Set(cells.map(cell => cell.rowOffset));
    const columns = new Set(cells.map(cell => cell.columnOffset));
    const { rowCount, columnCount } = table;

    const isWholeColumn = columns.size === 1 && rows.size === rowCount;
    const isWholeRow = rows.size === 1 && columns.size === columnCount;
    const isWholeTable
        = rows.size === rowCount
            && columns.size === columnCount
            && cells.length === rowCount * columnCount;

    if (!isWholeColumn && !isWholeRow && !isWholeTable)
        return false;

    const cursorOffsetRow = [...rows][0];
    const cursorOffsetColumn = [...columns][0];

    clipboard.selection.table.clear();

    if (isWholeTable) {
        const outsideContent
            = table.nextContentInContext() ?? table.previousContentInContext();
        table.remove();
        if (clipboard.scrollPage?.length() === 0) {
            resetToEmptyParagraph(clipboard);
        }
        else {
            outsideContent?.setCursor(0, 0, true);
        }
    }
    else if (isWholeColumn) {
        const cursorBlock = table.removeColumn(cursorOffsetColumn);
        cursorBlock?.setCursor(0, 0, true);
    }
    else {
        const cursorBlock = table.removeRow(cursorOffsetRow);
        cursorBlock?.setCursor(0, 0, true);
    }

    return true;
}

export function cutSelection(clipboard: Clipboard): void {
    // A frozen cross-cell table selection. When every selected cell is
    // already empty and the rectangle covers a whole row / column / table,
    // delete that structure; otherwise empty the cells in place. The copy half
    // already captured the
    // rectangle's markdown via `getClipboardData`.
    if (clipboard.selection.table.hasSelection) {
        if (!cutEmptyTableStructure(clipboard))
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
            = direction === 'forward' ? anchor.offset : focus.offset;
        const endOffset = direction === 'forward' ? focus.offset : anchor.offset;

        anchorBlock.text
            = text.substring(0, startOffset) + text.substring(endOffset);

        return anchorBlock.setCursor(startOffset, startOffset, true);
    }

    const startBlock = direction === 'forward' ? anchorBlock : focusBlock;
    const endBlock = direction === 'forward' ? focusBlock : anchorBlock;
    const startOffset = direction === 'forward' ? anchor.offset : focus.offset;
    const endOffset = direction === 'forward' ? focus.offset : anchor.offset;

    // Whole-document selection collapses to a single empty paragraph.
    if (isSelectAll(clipboard, startBlock, startOffset, endBlock, endOffset)) {
        resetToEmptyParagraph(clipboard);

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

    startBlock.setCursor(startOffset, startOffset, true);

    if (clipboard.scrollPage?.length() === 0) {
        resetToEmptyParagraph(clipboard);
    }
}
