import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type Table from '../block/gfm/table';
import type TableBodyCell from '../block/gfm/table/cell';
import type TableCellSelection from '../editor/tableCellSelection';
import type { Muya } from '../muya';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import { fromEvent, merge } from 'rxjs';
import CodeBlockContent from '../block/content/codeBlockContent';
import { ScrollPage } from '../block/scrollPage';
import { URL_REG } from '../config';
import HtmlToMarkdown from '../state/htmlToMarkdown';
import { MarkdownToState } from '../state/markdownToState';
import StateToMarkdown from '../state/stateToMarkdown';
import { isAnyListState, isParagraphState } from '../state/types';
import { getUniqueId, isClipboardEvent, isKeyboardEvent } from '../utils';
import { getBlock } from '../utils/dom';
import { getClipBoardHtml, getSanitizeClipboardHtml } from '../utils/marked';
import { getClipboardImageFile, getCopyTextType, isStandaloneTableHtml, normalizePastedHTML, readFileAsDataURL, resolveClipboardImagePath } from '../utils/paste';
import { mergePasteIntoHeading } from './mergePasteIntoHeading';

class Clipboard {
    public copyType: string = 'normal'; // `normal` or `copyAsMarkdown` or `copyAsHtml` or `copyAsRich` or `copyCodeContent`
    public pasteType: string = 'normal'; // `normal` or `pasteAsPlainText`
    public copyInfo: string = '';

    get selection() {
        return this.muya.editor.selection;
    }

    get scrollPage() {
        return this.muya.editor.scrollPage;
    }

    static create(muya: Muya) {
        const clipboard = new Clipboard(muya);
        clipboard.listen();

        return clipboard;
    }

    constructor(public muya: Muya) {}

    listen() {
        const { domNode } = this.muya;

        const copyCutHandler = (event: Event) => {
            if (!isClipboardEvent(event))
                return;
            event.preventDefault();
            event.stopPropagation();

            const isCut = event.type === 'cut';

            this.copyHandler(event);

            if (isCut)
                this.cutHandler();
        };

        const keydownHandler = (event: Event) => {
            if (!isKeyboardEvent(event))
                return;
            const { key, metaKey } = event;

            const { isSelectionInSameBlock } = this.selection.getSelection() ?? {};
            if (isSelectionInSameBlock)
                return;

            // TODO: Is there any way to identify these key bellow?
            if (
                /Alt|Option|Meta|Shift|CapsLock|ArrowUp|ArrowDown|ArrowLeft|ArrowRight/.test(
                    key,
                )
            ) {
                return;
            }

            if (metaKey)
                return;

            if (key === 'Backspace' || key === 'Delete')
                event.preventDefault();

            this.cutHandler();
        };

        const pasteHandler = (event: Event) => {
            if (isClipboardEvent(event))
                this.pasteHandler(event);
        };

        merge(fromEvent(domNode, 'copy'), fromEvent(domNode, 'cut'))
            .subscribe(copyCutHandler);

        fromEvent(domNode, 'paste').subscribe(pasteHandler);
        fromEvent(domNode, 'keydown').subscribe(keydownHandler);
    }

    get tableSelection(): Nullable<TableCellSelection> {
        return this.muya.editor?.tableSelection;
    }

    getClipboardData() {
        const { copyType, copyInfo } = this;
        if (copyType === 'copyCodeContent') {
            return {
                html: '',
                text: copyInfo,
            };
        }

        // A frozen cross-cell table selection copies just that rectangle.
        const tableData = this._getTableSelectionClipboardData();
        if (tableData != null)
            return tableData;

        let text = '';
        let html = '';

        const selection = this.selection.getSelection();
        if (selection == null) {
            return {
                html,
                text,
            };
        }

        const { isSelectionInSameBlock, anchor, anchorBlock, focus, focusBlock }
            = selection;

        if (anchorBlock == null || focusBlock == null) {
            return {
                html,
                text,
            };
        }

        const {
            frontMatter = true,
            math,
            isGitlabCompatibilityEnabled,
            superSubScript,
        } = this.muya.options;
        // Handler copy/cut in one block.
        if (isSelectionInSameBlock) {
            const begin = Math.min(anchor.offset, focus.offset);
            const end = Math.max(anchor.offset, focus.offset);

            text = anchorBlock.text.substring(begin, end);
            html = getClipBoardHtml(text, {
                frontMatter,
                math,
                isGitlabCompatibilityEnabled,
                superSubScript,
            });

            return { html, text };
        }
        // Handle select multiple blocks.
        const copyState: TState[] = [];
        const anchorOutMostBlock = anchorBlock.outMostBlock!;
        const focusOutMostBlock = focusBlock.outMostBlock!;
        const anchorOutMostBlockOffset
            = this.scrollPage?.offset(anchorOutMostBlock);
        const focusOutMostBlockOffset = this.scrollPage?.offset(focusOutMostBlock);
        if (anchorOutMostBlockOffset == null || focusOutMostBlockOffset == null) {
            return {
                html,
                text,
            };
        }

        const startOutBlock
            = anchorOutMostBlockOffset <= focusOutMostBlockOffset
                ? anchorOutMostBlock
                : focusOutMostBlock;
        const endOutBlock
            = anchorOutMostBlockOffset <= focusOutMostBlockOffset
                ? focusOutMostBlock
                : anchorOutMostBlock;
        const startBlock
            = anchorOutMostBlockOffset <= focusOutMostBlockOffset
                ? anchorBlock
                : focusBlock;
        const endBlock
            = anchorOutMostBlockOffset <= focusOutMostBlockOffset
                ? focusBlock
                : anchorBlock;
        const startOffset
            = anchorOutMostBlockOffset <= focusOutMostBlockOffset
                ? anchor.offset
                : focus.offset;
        const endOffset
            = anchorOutMostBlockOffset <= focusOutMostBlockOffset
                ? focus.offset
                : anchor.offset;

        const getPartialState = (position: 'start' | 'end') => {
            const outBlock = position === 'start' ? startOutBlock : endOutBlock;
            const block = position === 'start' ? startBlock : endBlock;
            // Handle anchor and focus in different blocks
            if (
                /block-quote|code-block|html-block|table|math-block|frontmatter|diagram/.test(
                    outBlock!.blockName,
                )
            ) {
                copyState.push((outBlock as Parent).getState());
            }
            else if (/bullet-list|order-list|task-list/.test(outBlock!.blockName)) {
                const listItemBlockName
                    = outBlock!.blockName === 'task-list' ? 'task-list-item' : 'list-item';
                const listItem = block.farthestBlock(listItemBlockName);
                const offset = (outBlock as Parent).offset(listItem!);
                // outBlock is a list parent at runtime; getState() returns a
                // bullet/order/task-list state whose `children` is an
                // IListItemState/ITaskListItemState array. Narrow via the
                // discriminated-union guard before slicing.
                const listState = (outBlock as Parent).getState();
                if (isAnyListState(listState)) {
                    if (listState.name === 'task-list') {
                        copyState.push({
                            name: 'task-list',
                            meta: listState.meta,
                            children: listState.children.filter((_, index) =>
                                position === 'start' ? index >= offset : index <= offset,
                            ),
                        });
                    }
                    else if (listState.name === 'order-list') {
                        copyState.push({
                            name: 'order-list',
                            meta: listState.meta,
                            children: listState.children.filter((_, index) =>
                                position === 'start' ? index >= offset : index <= offset,
                            ),
                        });
                    }
                    else {
                        copyState.push({
                            name: 'bullet-list',
                            meta: listState.meta,
                            children: listState.children.filter((_, index) =>
                                position === 'start' ? index >= offset : index <= offset,
                            ),
                        });
                    }
                }
            }
            else {
                if (position === 'start' && startOffset < startBlock.text.length) {
                    copyState.push({
                        name: 'paragraph',
                        text: startBlock.text.substring(startOffset),
                    });
                }
                else if (position === 'end' && endOffset > 0) {
                    copyState.push({
                        name: 'paragraph',
                        text: endBlock.text.substring(0, endOffset),
                    });
                }
            }
        };

        if (anchorOutMostBlock === focusOutMostBlock) {
            // Handle anchor and focus in same list\quote block
            if (/block-quote|table/.test(anchorOutMostBlock!.blockName)) {
                copyState.push((anchorOutMostBlock as Parent).getState());
            }
            else {
                const listItemBlockName
                    = anchorOutMostBlock!.blockName === 'task-list'
                        ? 'task-list-item'
                        : 'list-item';
                const anchorFarthestListItem
                    = anchorBlock.farthestBlock(listItemBlockName);
                const focusFarthestListItem
                    = focusBlock.farthestBlock(listItemBlockName);
                const anchorOffset = (anchorOutMostBlock as Parent).offset(
                    anchorFarthestListItem!,
                );
                const focusOffset = (anchorOutMostBlock as Parent).offset(
                    focusFarthestListItem!,
                );
                const minOffset = Math.min(anchorOffset, focusOffset);
                const maxOffset = Math.max(anchorOffset, focusOffset);
                const listState = (anchorOutMostBlock as Parent).getState();
                if (isAnyListState(listState)) {
                    if (listState.name === 'task-list') {
                        copyState.push({
                            name: 'task-list',
                            meta: listState.meta,
                            children: listState.children.filter((_, index) => index >= minOffset && index <= maxOffset),
                        });
                    }
                    else if (listState.name === 'order-list') {
                        copyState.push({
                            name: 'order-list',
                            meta: listState.meta,
                            children: listState.children.filter((_, index) => index >= minOffset && index <= maxOffset),
                        });
                    }
                    else {
                        copyState.push({
                            name: 'bullet-list',
                            meta: listState.meta,
                            children: listState.children.filter((_, index) => index >= minOffset && index <= maxOffset),
                        });
                    }
                }
            }
        }
        else {
            getPartialState('start');
            // Get State between the start outmost block and the end outmost block.
            let node = startOutBlock?.next;
            while (node && node !== endOutBlock) {
                copyState.push((node as Parent).getState());
                node = node.next;
            }
            getPartialState('end');
        }

        const mdGenerator = new StateToMarkdown();

        text = mdGenerator.generate(copyState);
        html = getClipBoardHtml(text, {
            frontMatter,
            math,
            isGitlabCompatibilityEnabled,
            superSubScript,
        });

        return { html, text };
    }

    /**
     * Clipboard payload for a frozen cross-cell table selection, or `null` when
     * none is active. A single selected cell with text yields its plain text and
     * no HTML (so a paste lands as literal text, matching legacy
     * `docCopyHandler`); a larger rectangle serialises to GFM table markdown.
     */
    private _getTableSelectionClipboardData(): Nullable<{ html: string; text: string }> {
        const state = this.tableSelection?.getStateForCopy();
        if (state == null)
            return null;

        const isSingleCell
            = state.children.length === 1 && state.children[0].children.length === 1;
        if (isSingleCell) {
            return { html: '', text: state.children[0].children[0].text };
        }

        const {
            frontMatter = true,
            math,
            isGitlabCompatibilityEnabled,
            superSubScript,
        } = this.muya.options;
        const text = new StateToMarkdown().generate([state]);
        const html = getClipBoardHtml(text, {
            frontMatter,
            math,
            isGitlabCompatibilityEnabled,
            superSubScript,
        });

        return { html, text };
    }

    copyHandler(event: ClipboardEvent): void {
        if (!event.clipboardData)
            return;

        // A selected inline image copies its raw `![alt](src)` markdown
        // verbatim (legacy `copyCutCtrl.copyHandler`), short-circuiting the
        // text-selection clipboard data.
        const selectedImage = this.muya.editor?.selection?.selectedImage;
        if (selectedImage) {
            const { raw } = selectedImage.token;
            if (raw.length > 0) {
                event.clipboardData.setData('text/html', raw);
                event.clipboardData.setData('text/plain', raw);
            }
            return;
        }

        const { copyType } = this;

        const { html, text } = this.getClipboardData();

        // Mirror native copy behaviour: leave the system clipboard untouched
        // when the selection has nothing to contribute, so a previous copy
        // from another app isn't silently clobbered (marktext #3130).
        switch (copyType) {
            case 'normal': {
                if (text.length === 0)
                    return;
                event.clipboardData.setData('text/html', '');
                event.clipboardData.setData('text/plain', text);
                break;
            }

            case 'copyAsHtml': {
                if (text.length === 0)
                    return;
                const {
                    frontMatter = true,
                    math,
                    isGitlabCompatibilityEnabled,
                    superSubScript,
                } = this.muya.options ?? {};
                event.clipboardData.setData('text/html', '');
                event.clipboardData.setData(
                    'text/plain',
                    getSanitizeClipboardHtml(text, {
                        frontMatter,
                        math,
                        isGitlabCompatibilityEnabled,
                        superSubScript,
                    }),
                );
                break;
            }

            // "Copy as Rich Text": put the rendered HTML in the html slot so a
            // rich-text target (Word, email, contenteditable) renders formatted
            // content, and keep the markdown source in the plain slot. Mirrors
            // the `normal` branch; `copyAsHtml` instead blanks text/html and
            // drops the markup into text/plain as literal source.
            case 'copyAsRich': {
                if (text.length === 0)
                    return;
                event.clipboardData.setData('text/html', html);
                event.clipboardData.setData('text/plain', text);
                break;
            }

            case 'copyAsMarkdown': {
                if (text.length === 0)
                    return;
                event.clipboardData.setData('text/html', '');
                event.clipboardData.setData('text/plain', text);
                break;
            }

            case 'copyCodeContent': {
                if (text.length === 0)
                    return;
                event.clipboardData.setData('text/html', '');
                event.clipboardData.setData('text/plain', text);
                break;
            }
        }
    }

    cutHandler() {
        // A frozen cross-cell table selection. When every selected cell is
        // already empty and the rectangle covers a whole row / column / table,
        // delete that structure (legacy `deleteSelectedTableCells`); otherwise
        // empty the cells in place. The copy half already captured the
        // rectangle's markdown via `getClipboardData`.
        if (this.tableSelection?.hasSelection) {
            if (!this._cutEmptyTableStructure())
                this.tableSelection.clearSelectedCells();

            return;
        }

        const selection = this.selection.getSelection();
        if (selection == null)
            return;

        const {
            isSelectionInSameBlock,
            anchor,
            anchorBlock,
            focus,
            focusBlock,
            direction,
        } = selection;

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

        // Whole-document selection collapses to a single empty paragraph
        // (legacy `backspaceCtrl` `isSelectAll` reset).
        if (this._isSelectAll(startBlock, startOffset, endBlock, endOffset)) {
            this._resetToEmptyParagraph();

            return;
        }

        // Leaf-level merge (legacy `cutHandler` + `removeBlocks`): keep the
        // start head and the end tail in the start content block, then remove
        // only the structure strictly between the two leaves (and the emptied
        // end-side containers). The start block keeps its container — a list
        // item stays a list item, a quote stays a quote.
        startBlock.text
            = startBlock.text.substring(0, startOffset)
                + endBlock.text.substring(endOffset);

        this._removeBlocks(startBlock, endBlock);

        startBlock.setCursor(startOffset, startOffset, true);

        if (this.scrollPage?.length() === 0) {
            this._resetToEmptyParagraph();
        }
    }

    /**
     * Whole-document selection predicate, ported from legacy
     * `paragraphCtrl.isSelectAll`: the selection spans from the very first
     * content leaf at offset 0 to the very last content leaf at its end.
     */
    private _isSelectAll(
        startBlock: Content,
        startOffset: number,
        endBlock: Content,
        endOffset: number,
    ): boolean {
        const firstContent = this.scrollPage?.firstContentInDescendant();
        const lastContent = this.scrollPage?.lastContentInDescendant();

        return (
            firstContent === startBlock
            && startOffset === 0
            && lastContent === endBlock
            && endOffset === endBlock.text.length
        );
    }

    /**
     * Replace the whole document with a single empty paragraph and seat the
     * caret in it (legacy `backspaceCtrl` `isSelectAll` reset / empty-document
     * guard).
     */
    private _resetToEmptyParagraph(): void {
        const { scrollPage } = this;
        if (scrollPage == null)
            return;

        scrollPage.forEach((child) => {
            (child as Parent).remove();
        });

        const newParagraphBlock = ScrollPage.loadBlock('paragraph').create(
            this.muya,
            { name: 'paragraph', text: '' },
        );
        scrollPage.append(newParagraphBlock, 'user');

        const cursorBlock = newParagraphBlock.firstContentInDescendant();
        cursorBlock?.setCursor(0, 0, true);
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
    private _removeBlocks(before: TreeNode, after: TreeNode): void {
        // A table is exempt from structural removal (legacy `removeBlocks`
        // `exemption` for `td`/`th`): empty the spanned cells in place and keep
        // the grid rather than deleting cells/rows.
        const beforeTable = before.closestBlock('table');
        const afterTable = after.closestBlock('table');

        // Both endpoints inside the same table — empty every cell strictly
        // between them and keep the grid.
        if (beforeTable != null && beforeTable === afterTable) {
            let cellContent = before.nextContentInContext();
            while (cellContent) {
                if (cellContent.text !== '')
                    cellContent.text = '';

                if (cellContent === after)
                    break;

                cellContent = cellContent.nextContentInContext();
            }

            return;
        }

        // `after` lands inside a table that does not also contain `before`:
        // remove only the blocks between `before` and the table, then empty the
        // spanned cells.
        if (afterTable != null) {
            this._removeBlocksIntoTable(before, after, afterTable as Parent);

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

        // `after`'s branch is removed but later siblings inside `afterBranch`
        // survive. Walk up from `after` to the direct child of `afterBranch`,
        // removing each on-path node's preceding siblings and any ancestor it
        // leaves empty, stopping below `afterBranch`.
        let onPath: TreeNode = after;
        while (onPath.parent && onPath.parent !== afterBranch) {
            let prev = onPath.prev;
            while (prev) {
                const temp = prev.prev;
                prev.remove();
                prev = temp;
            }
            const parent = onPath.parent;
            onPath.remove();
            if (parent.children.length > 0)
                return;

            onPath = parent;
        }

        // `onPath` is now the direct child of `afterBranch` on `after`'s path —
        // remove its preceding siblings and itself; later siblings survive.
        let prev = onPath.prev;
        while (prev) {
            const temp = prev.prev;
            prev.remove();
            prev = temp;
        }
        onPath.remove();
    }

    /**
     * Handle a cross-block cut whose end lands inside a table. The table grid is
     * exempt from structural removal (legacy `removeBlocks` `exemption`): remove
     * the outmost blocks strictly between `before` and the table, then empty —
     * not remove — every cell from the table's first cell up to and including
     * `after`'s cell.
     */
    private _removeBlocksIntoTable(
        before: TreeNode,
        after: TreeNode,
        table: Parent,
    ): void {
        const beforeOutMost = before.outMostBlock;

        // Remove every outmost block strictly between `before`'s outmost block
        // and the table.
        if (beforeOutMost != null) {
            let between = beforeOutMost.next;
            while (between && between !== table) {
                const temp = between.next;
                between.remove();
                between = temp;
            }
        }

        // Empty the cell content leaves from the table start through `after`'s
        // cell, keeping the grid intact.
        let cellContent: Nullable<Content> = table.firstContentInDescendant();
        while (cellContent) {
            if (cellContent.text !== '')
                cellContent.text = '';

            if (cellContent === after)
                break;

            cellContent = cellContent.nextContentInContext();
        }
    }

    /**
     * Structurally delete an empty whole row / column / table when cutting a
     * frozen table-cell selection. Returns `true` when it handled the cut (the
     * caller then skips the in-place clear), `false` to fall through to the
     * in-place clear. Mirrors legacy `deleteSelectedTableCells` (152-211).
     */
    private _cutEmptyTableStructure(): boolean {
        const selectedCells = this._selectedTableCells();
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

        this.tableSelection?.clear();

        if (isWholeTable) {
            const outsideContent
                = table.nextContentInContext() ?? table.previousContentInContext();
            table.remove();
            if (this.scrollPage?.length() === 0) {
                this._resetToEmptyParagraph();
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

    /**
     * Resolve the frozen table selection to its table and the list of selected
     * body cells, reading the highlighted cell DOM nodes. Returns `null` when
     * there is no resolvable selection.
     */
    private _selectedTableCells(): Nullable<{ table: Table; cells: TableBodyCell[] }> {
        const { domNode } = this.muya;
        const selectedDoms = domNode.querySelectorAll('.mu-table-cell-selected');
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

    // eslint-disable-next-line complexity
    async pasteHandler(
        event: ClipboardEvent,
        // `event.clipboardData` is only valid synchronously while the paste
        // event is being dispatched. Once `pasteHandler` yields at its first
        // `await` (the `clipboardFilePath` hook), the browser may detach the
        // DataTransfer and subsequent `getData()` calls return ''. We snapshot
        // text/html synchronously below and thread the snapshot through the
        // `!isSelectionInSameBlock` recursion via these optional params so the
        // re-entry doesn't read a detached clipboard. Mirrors the legacy
        // `@muyajs` `pasteHandler(event, type, rawText, rawHtml)` signature.
        rawText?: string,
        rawHtml?: string,
    ): Promise<void> {
        event.preventDefault();
        event.stopPropagation();

        const { muya } = this;
        const {
            bulletListMarker,
            footnote,
            isGitlabCompatibilityEnabled,
            math,
            trimUnnecessaryCodeBlockEmptyLines,
            frontMatter,
        } = muya.options;
        const selection = this.selection.getSelection();
        if (!selection)
            return;

        const { isSelectionInSameBlock, anchorBlock } = selection;

        if (!anchorBlock || !event.clipboardData)
            return;

        // Snapshot everything we need from `event.clipboardData`
        // synchronously, BEFORE any `await` — after the first yield the
        // DataTransfer can be detached and `getData()` returns ''. On the
        // `!isSelectionInSameBlock` recursion we reuse the snapshot captured
        // by the outer call rather than re-reading the (now possibly
        // detached) clipboard.
        const text = rawText ?? event.clipboardData.getData('text/plain');
        let html = rawHtml ?? event.clipboardData.getData('text/html');
        // Snapshot any in-memory image File (the bitmap / "Copy Image" /
        // screenshot case, PG05) synchronously too — `clipboardData.files`
        // is also detached after the first `await`.
        const imageFile = getClipboardImageFile(event.clipboardData);

        if (!isSelectionInSameBlock) {
            this.cutHandler();

            return this.pasteHandler(event, text, html);
        }

        // When the clipboard holds an image — either a file resolved to a path
        // (PG06) or an in-memory bitmap (PG05) — insert it as an inline image
        // routed through `imageAction`, short-circuiting the text/HTML paste.
        if (await this.tryPasteImage(anchorBlock, imageFile))
            return;

        // Support pasted URLs from Firefox.
        if (URL_REG.test(text) && !/\s/.test(text) && !html)
            html = `<a href="${text}">${text}</a>`;

        // Apple Numbers and a handful of other sources only put a raw
        // `<table>...</table>` blob in text/plain. Promote it to the HTML
        // slot so it goes through the HTML→Markdown converter rather than
        // being inserted verbatim (marktext 067ec485 / #1271).
        if (!html && isStandaloneTableHtml(text))
            html = text;

        // Remove crap from HTML such as meta data and styles.
        html = await normalizePastedHTML(html);
        const copyType = getCopyTextType(html, text, this.pasteType);

        const { start, end } = anchorBlock.getCursor()!;
        const { text: content } = anchorBlock;
        let wrapperBlock = anchorBlock.getAnchor();
        const originWrapperBlock = wrapperBlock;

        if (/html|text/.test(copyType)) {
            let markdown
                = copyType === 'html' && anchorBlock.blockName !== 'codeblock.content'
                    ? new HtmlToMarkdown({ bulletListMarker }).generate(html)
                    : text;

            // `language-input`, `table.cell.content` and `codeblock.content`
            // never parse a paste into blocks — they take the text literally
            // (legacy `pasteCtrl.pasteHandler` `languageInput` / `cellContent` /
            // `codeContent` branches). Every other anchor always parses through
            // `MarkdownToState`, regardless of line count, so a single line of
            // `# heading` / `- list` / a one-row table becomes real structure.
            const isLiteralAnchor
                = anchorBlock.blockName === 'language-input'
                    || anchorBlock.blockName === 'table.cell.content'
                    || anchorBlock.blockName === 'codeblock.content';

            if (!isLiteralAnchor) {
                // An empty / whitespace-only paste is a no-op (legacy
                // `pasteCtrl` bails on `stateFragments.length <= 0`); the parser
                // would otherwise emit a lone empty paragraph and churn blocks.
                if (markdown.trim().length === 0)
                    return;

                const states = new MarkdownToState({
                    footnote,
                    math,
                    isGitlabCompatibilityEnabled,
                    trimUnnecessaryCodeBlockEmptyLines,
                    frontMatter,
                }).generate(markdown);

                // When pasting into a heading, splice the first paragraph
                // back into the heading text so the heading semantics survive.
                // The helper also collapses any selection on the heading.
                // Backport of marktext 1c42555a (#671).
                const remaining = mergePasteIntoHeading(
                    anchorBlock,
                    wrapperBlock,
                    states,
                    { startOffset: start.offset, endOffset: end.offset },
                );

                if (remaining === states && start.offset !== end.offset) {
                    anchorBlock.text
                        = content.substring(0, start.offset) + content.substring(end.offset);
                    anchorBlock.update();
                }

                for (const state of remaining) {
                    const newBlock = ScrollPage.loadBlock(state.name).create(muya, state);
                    wrapperBlock?.parent?.insertAfter(newBlock, wrapperBlock);
                    wrapperBlock = newBlock;
                }

                // Remove empty paragraph when paste.
                if (originWrapperBlock?.blockName === 'paragraph') {
                    const originState = originWrapperBlock.getState();
                    if (isParagraphState(originState) && originState.text === '')
                        originWrapperBlock.remove();
                }

                const cursorBlock = wrapperBlock?.firstContentInDescendant();
                const offset = cursorBlock?.text.length;

                if (offset != null)
                    cursorBlock?.setCursor(offset, offset, true);
            }
            else {
                // A frozen table-cell selection scopes the paste: a single cell
                // gets its text replaced (with `\n` → `<br/>`); a multi-cell
                // rectangle cancels the paste (legacy `pasteCtrl.pasteHandler`
                // `cellContent` branch).
                if (
                    anchorBlock.blockName === 'table.cell.content'
                    && this.tableSelection?.hasSelection
                ) {
                    if (!this._isSingleCellSelected())
                        return;

                    anchorBlock.text = markdown.trim().replace(/\n/g, '<br/>');
                    const offset = anchorBlock.text.length;
                    anchorBlock.setCursor(offset, offset, true);
                    this.tableSelection.clear();

                    return;
                }

                if (anchorBlock.blockName === 'language-input')
                    markdown = markdown.replace(/\n/g, '');
                else if (anchorBlock.blockName === 'table.cell.content')
                    markdown = markdown.replace(/\n/g, '<br/>');

                anchorBlock.text
                    = content.substring(0, start.offset)
                        + markdown
                        + content.substring(end.offset);
                const offset = start.offset + markdown.length;
                anchorBlock.setCursor(offset, offset, true);
                // Update html preview if the out container is `html-block`
                if (
                    anchorBlock instanceof CodeBlockContent
                    && anchorBlock.outContainer
                    && /html-block|math-block|diagram/.test(
                        anchorBlock.outContainer.blockName,
                    )
                ) {
                    // The attachments list of html-block / math-block /
                    // diagram blocks always opens with the render preview
                    // node, which exposes an `update(text)` method. The
                    // LinkedList itself is typed loosely; narrow via a
                    // structural shape check before calling.
                    const head = anchorBlock.outContainer.attachments.head;
                    const updater = head as TreeNode & { update?: (text: string) => void };
                    if (typeof updater.update === 'function')
                        updater.update(anchorBlock.text);
                }
            }
        }
        else {
            // Block-level HTML (`<ul>`/`<ol>`/`<pre>`/`<blockquote>` … — tags in
            // `PARAGRAPH_TYPES`) lands as a live html-block (legacy
            // `pasteCtrl` `copyAsHtml` → `insertHtmlBlock`), not a fenced ```html
            // code block, so the markup renders in place.
            const state = {
                name: 'html-block',
                text: text.trim(),
            };
            const newBlock = ScrollPage.loadBlock(state.name).create(muya, state);
            wrapperBlock?.parent?.insertAfter(newBlock, wrapperBlock);

            // Drop the empty paragraph the html-block replaced.
            if (originWrapperBlock?.blockName === 'paragraph') {
                const originState = originWrapperBlock.getState();
                if (isParagraphState(originState) && originState.text === '')
                    originWrapperBlock.remove();
            }

            const offset = state.text.length;
            newBlock.lastContentInDescendant().setCursor(offset, offset, true);
        }
    }

    /**
     * Whether the frozen table-cell selection covers exactly one cell. Mirrors
     * the single-cell shape check used by `_getTableSelectionClipboardData`:
     * one row containing one cell. Used by `pasteHandler` to decide between
     * replacing a single cell's text and cancelling a multi-cell paste.
     */
    private _isSingleCellSelected(): boolean {
        const state = this.tableSelection?.getStateForCopy();
        if (state == null)
            return false;

        return state.children.length === 1 && state.children[0].children.length === 1;
    }

    /**
     * Insert a pasted image when the clipboard carries one. Tries a resolved
     * clipboard FILE path first (PG06, via the `clipboardFilePath` hook), then
     * an in-memory bitmap File (PG05, read as a base64 `data:` URL). Returns
     * `true` when an image was inserted so the caller skips the text/HTML
     * paste, `false` to fall through. Ported from the legacy `@muyajs`
     * `pasteImage` ordering (file path, then binary).
     */
    private async tryPasteImage(
        anchorBlock: Content,
        imageFile: Nullable<File>,
    ): Promise<boolean> {
        const imagePath = await resolveClipboardImagePath(
            this.muya.options.clipboardFilePath,
        );
        if (imagePath) {
            await this.insertImageSrc(anchorBlock, imagePath);
            return true;
        }

        if (imageFile) {
            const dataUrl = await readFileAsDataURL(imageFile);
            if (dataUrl) {
                await this.insertImageSrc(anchorBlock, dataUrl);
                return true;
            }
        }

        return false;
    }

    /**
     * Insert a pasted image at the cursor, routing it through the embedder's
     * `imageAction` so the user's insert preference (copy-to-assets / upload /
     * keep-path) applies and a portable src is written. `src` is either a
     * resolved clipboard file path (PG06) or a `data:` URL for an in-memory
     * bitmap (PG05).
     *
     * A `loading-<id>` placeholder image is spliced in synchronously (with the
     * incoming `src` as a temporary preview) BEFORE awaiting `imageAction`, then
     * replaced with the resolved src once it settles — mirroring legacy
     * `pasteCtrl.pasteImage`'s loading-id insert → imageAction → replace flow,
     * so the user sees a placeholder while the upload/copy runs. When no
     * `imageAction` is configured the placeholder's src is the final one.
     */
    private async insertImageSrc(anchorBlock: Content, src: string): Promise<void> {
        const { imageAction } = this.muya.options;

        // No async insert preference: write the final image directly, no
        // placeholder (there is nothing to wait for).
        if (!imageAction) {
            this.insertImageText(anchorBlock, src);

            return;
        }

        const id = `loading-${getUniqueId()}`;
        const placeholderText = this.insertImageText(anchorBlock, src, id);

        let finalSrc = src;
        const resolved = await imageAction({ src, alt: '', title: '' });
        if (resolved)
            finalSrc = resolved;

        this._replacePlaceholderImage(anchorBlock, placeholderText, finalSrc);
    }

    /**
     * Splice `![alt](src)` into the anchor block at the current selection and
     * return the exact text inserted.
     *
     * Inline images in muya are plain markdown text (`![](src)`) on a content
     * block; rendering turns the token into an image. We replace any
     * collapsed/expanded range and place the cursor after it. The src is
     * escaped the same way as {@link Format.replaceImage} so spaces and `#`
     * survive in the path.
     */
    private insertImageText(anchorBlock: Content, src: string, alt = ''): string {
        const cursor = anchorBlock.getCursor();
        if (!cursor)
            return '';

        const { start, end } = cursor;
        const { text: content } = anchorBlock;
        const escapedSrc = src
            .replace(/ /g, encodeURI(' '))
            .replace(/#/g, encodeURIComponent('#'));
        const imageText = `![${alt}](${escapedSrc})`;

        anchorBlock.text
            = content.substring(0, start.offset)
                + imageText
                + content.substring(end.offset);

        const offset = start.offset + imageText.length;
        anchorBlock.setCursor(offset, offset, true);

        return imageText;
    }

    /**
     * Replace the `loading-<id>` placeholder image previously inserted by
     * {@link insertImageText} with the final `![](src)`, once `imageAction`
     * resolved. The cursor is seated right after the swapped image.
     */
    private _replacePlaceholderImage(
        anchorBlock: Content,
        placeholderText: string,
        src: string,
    ): void {
        const index = anchorBlock.text.indexOf(placeholderText);
        if (index === -1)
            return;

        const escapedSrc = src
            .replace(/ /g, encodeURI(' '))
            .replace(/#/g, encodeURIComponent('#'));
        const imageText = `![](${escapedSrc})`;

        anchorBlock.text
            = anchorBlock.text.substring(0, index)
                + imageText
                + anchorBlock.text.substring(index + placeholderText.length);

        const offset = index + imageText.length;
        anchorBlock.setCursor(offset, offset, true);
    }

    copyAsMarkdown() {
        this.copyType = 'copyAsMarkdown';
        document.execCommand('copy');
        this.copyType = 'normal';
    }

    copyAsHtml() {
        this.copyType = 'copyAsHtml';
        document.execCommand('copy');
        this.copyType = 'normal';
    }

    copyAsRich() {
        this.copyType = 'copyAsRich';
        document.execCommand('copy');
        this.copyType = 'normal';
    }

    pasteAsPlainText() {
        this.pasteType = 'pasteAsPlainText';
        document.execCommand('paste');
        this.pasteType = 'normal';
    }

    copy(type: string, info: string) {
        this.copyType = type;
        this.copyInfo = info;
        document.execCommand('copy');
        this.copyType = 'normal';
    }
}

export default Clipboard;
