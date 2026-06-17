import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type { Muya } from '../muya';
import type { ISelection } from '../selection/types';
import type {
    IBulletListState,
    IOrderListState,
    ITaskListState,
    TState,
} from '../state/types';
import type { Nullable } from '../types';
import type Clipboard from './index';
import StateToMarkdown from '../state/stateToMarkdown';
import { isAnyListState } from '../state/types';
import { getClipBoardHtml, getSanitizeClipboardHtml } from '../utils/marked';
import { CopyType } from './types';

export interface IClipboardPayload {
    html: string;
    text: string;
}

// Document-order resolution of a cross-block selection: the start/end outmost
// blocks, the start/end content leaves, and their offsets, ordered so `start`
// precedes `end` in the document regardless of selection direction.
interface ICopyOrder {
    anchorBlock: Content;
    focusBlock: Content;
    anchorOutMostBlock: Parent;
    focusOutMostBlock: Parent;
    startOutBlock: Parent;
    endOutBlock: Parent;
    startBlock: Content;
    endBlock: Content;
    startOffset: number;
    endOffset: number;
}

function buildHtmlOptions(options: Muya['options']) {
    const {
        frontMatter = true,
        math,
        isGitlabCompatibilityEnabled,
        superSubScript,
    } = options;

    return { frontMatter, math, isGitlabCompatibilityEnabled, superSubScript };
}

// Collapse the three list flavours (task/order/bullet) into one slice
// operation. `keep` decides which list items survive by index; the discriminated
// union is rebuilt per-branch so each `children` array keeps its concrete type.
function sliceListState(
    listState: IOrderListState | IBulletListState | ITaskListState,
    keep: (index: number) => boolean,
): IOrderListState | IBulletListState | ITaskListState {
    switch (listState.name) {
        case 'task-list':
            return {
                name: 'task-list',
                meta: listState.meta,
                children: listState.children.filter((_, index) => keep(index)),
            };
        case 'order-list':
            return {
                name: 'order-list',
                meta: listState.meta,
                children: listState.children.filter((_, index) => keep(index)),
            };
        default:
            return {
                name: 'bullet-list',
                meta: listState.meta,
                children: listState.children.filter((_, index) => keep(index)),
            };
    }
}

/**
 * Clipboard payload for a frozen cross-cell table selection, or `null` when
 * none is active. A single selected cell with text yields its plain text and
 * no HTML (so a paste lands as literal text, matching legacy
 * `docCopyHandler`); a larger rectangle serialises to GFM table markdown.
 */
function getTableSelectionClipboardData(
    clipboard: Clipboard,
): Nullable<IClipboardPayload> {
    const state = clipboard.selection.table.getStateForCopy();
    if (state == null)
        return null;

    const isSingleCell
        = state.children.length === 1 && state.children[0].children.length === 1;
    if (isSingleCell) {
        return { html: '', text: state.children[0].children[0].text };
    }

    const text = new StateToMarkdown().generate([state]);
    const html = getClipBoardHtml(text, buildHtmlOptions(clipboard.muya.options));

    return { html, text };
}

// Returns `null` when the outmost-block offsets can't be read (e.g. no scroll page).
function resolveSelectionOrder(
    clipboard: Clipboard,
    selection: ISelection,
): Nullable<ICopyOrder> {
    const { anchor, focus } = selection;
    const anchorBlock = anchor.block;
    const focusBlock = focus.block;
    const anchorOutMostBlock = anchorBlock.outMostBlock!;
    const focusOutMostBlock = focusBlock.outMostBlock!;
    const anchorOutMostBlockOffset = clipboard.scrollPage?.offset(anchorOutMostBlock);
    const focusOutMostBlockOffset = clipboard.scrollPage?.offset(focusOutMostBlock);
    if (anchorOutMostBlockOffset == null || focusOutMostBlockOffset == null)
        return null;

    const anchorFirst = anchorOutMostBlockOffset <= focusOutMostBlockOffset;

    return {
        anchorBlock,
        focusBlock,
        anchorOutMostBlock,
        focusOutMostBlock,
        startOutBlock: anchorFirst ? anchorOutMostBlock : focusOutMostBlock,
        endOutBlock: anchorFirst ? focusOutMostBlock : anchorOutMostBlock,
        startBlock: anchorFirst ? anchorBlock : focusBlock,
        endBlock: anchorFirst ? focusBlock : anchorBlock,
        startOffset: anchorFirst ? anchor.offset : focus.offset,
        endOffset: anchorFirst ? focus.offset : anchor.offset,
    };
}

// Handle the start / end outmost block of a cross-block selection, pushing the
// partial state for whichever edge `position` names.
function appendPartialState(
    copyState: TState[],
    order: ICopyOrder,
    position: 'start' | 'end',
): void {
    const { startOutBlock, endOutBlock, startBlock, endBlock, startOffset, endOffset } = order;
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
            copyState.push(
                sliceListState(listState, index =>
                    position === 'start' ? index >= offset : index <= offset),
            );
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
}

function collectSameOutMostBlockState(order: ICopyOrder): TState[] {
    const { anchorOutMostBlock, anchorBlock, focusBlock } = order;
    const copyState: TState[] = [];

    // Handle anchor and focus in same list\quote block
    if (/block-quote|table/.test(anchorOutMostBlock!.blockName)) {
        copyState.push((anchorOutMostBlock as Parent).getState());

        return copyState;
    }

    const listItemBlockName
        = anchorOutMostBlock!.blockName === 'task-list'
            ? 'task-list-item'
            : 'list-item';
    const anchorFarthestListItem = anchorBlock.farthestBlock(listItemBlockName);
    const focusFarthestListItem = focusBlock.farthestBlock(listItemBlockName);
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
        copyState.push(
            sliceListState(
                listState,
                index => index >= minOffset && index <= maxOffset,
            ),
        );
    }

    return copyState;
}

function collectCopyState(order: ICopyOrder): TState[] {
    const { anchorOutMostBlock, focusOutMostBlock, startOutBlock, endOutBlock } = order;

    if (anchorOutMostBlock === focusOutMostBlock)
        return collectSameOutMostBlockState(order);

    const copyState: TState[] = [];
    appendPartialState(copyState, order, 'start');
    // Get State between the start outmost block and the end outmost block.
    let node: Nullable<TreeNode> = startOutBlock?.next;
    while (node && node !== endOutBlock) {
        copyState.push((node as Parent).getState());
        node = node.next;
    }
    appendPartialState(copyState, order, 'end');

    return copyState;
}

export function getClipboardData(clipboard: Clipboard): IClipboardPayload {
    const { copyType, copyInfo } = clipboard;
    if (copyType === CopyType.COPY_CODE_CONTENT) {
        return {
            html: '',
            text: copyInfo,
        };
    }

    // A frozen cross-cell table selection copies just that rectangle.
    const tableData = getTableSelectionClipboardData(clipboard);
    if (tableData != null)
        return tableData;

    const selection = clipboard.selection.getSelection();
    if (selection == null)
        return { html: '', text: '' };

    const { isSelectionInSameBlock, anchor, focus } = selection;
    const anchorBlock = anchor.block;
    const focusBlock = focus.block;

    if (anchorBlock == null || focusBlock == null)
        return { html: '', text: '' };

    const options = buildHtmlOptions(clipboard.muya.options);

    // Handler copy/cut in one block.
    if (isSelectionInSameBlock) {
        const begin = Math.min(anchor.offset, focus.offset);
        const end = Math.max(anchor.offset, focus.offset);

        const text = anchorBlock.text.substring(begin, end);

        return { html: getClipBoardHtml(text, options), text };
    }

    // Handle select multiple blocks.
    const order = resolveSelectionOrder(clipboard, selection);
    if (order == null)
        return { html: '', text: '' };

    const copyState = collectCopyState(order);

    const text = new StateToMarkdown().generate(copyState);
    const html = getClipBoardHtml(text, options);

    return { html, text };
}

export function writeClipboardData(
    clipboard: Clipboard,
    event: ClipboardEvent,
): void {
    if (!event.clipboardData)
        return;

    // A selected inline image copies its raw `![alt](src)` markdown
    // verbatim, short-circuiting the text-selection clipboard data.
    const selectedImage = clipboard.muya.editor?.selection?.image;
    if (selectedImage) {
        const { raw } = selectedImage.token;
        if (raw.length > 0) {
            event.clipboardData.setData('text/html', raw);
            event.clipboardData.setData('text/plain', raw);
        }
        return;
    }

    const { copyType } = clipboard;

    const { html, text } = clipboard.getClipboardData();

    // Mirror native copy behavior: leave the system clipboard untouched
    // when the selection has nothing to contribute, so a previous copy
    // from another app isn't silently clobbered (marktext #3130).
    switch (copyType) {
        case CopyType.NORMAL: {
            if (text.length === 0)
                return;
            event.clipboardData.setData('text/html', '');
            event.clipboardData.setData('text/plain', text);
            break;
        }

        case CopyType.COPY_AS_HTML: {
            if (text.length === 0)
                return;
            event.clipboardData.setData('text/html', '');
            event.clipboardData.setData(
                'text/plain',
                getSanitizeClipboardHtml(
                    text,
                    buildHtmlOptions(clipboard.muya.options ?? {}),
                ),
            );
            break;
        }

        // "Copy as Rich Text": put the rendered HTML in the html slot so a
        // rich-text target (Word, email, contenteditable) renders formatted
        // content, and keep the markdown source in the plain slot. Mirrors
        // the `normal` branch; `copyAsHtml` instead blanks text/html and
        // drops the markup into text/plain as literal source.
        case CopyType.COPY_AS_RICH: {
            if (text.length === 0)
                return;
            event.clipboardData.setData('text/html', html);
            event.clipboardData.setData('text/plain', text);
            break;
        }

        case CopyType.COPY_AS_MARKDOWN: {
            if (text.length === 0)
                return;
            event.clipboardData.setData('text/html', '');
            event.clipboardData.setData('text/plain', text);
            break;
        }

        case CopyType.COPY_CODE_CONTENT: {
            if (text.length === 0)
                return;
            event.clipboardData.setData('text/html', '');
            event.clipboardData.setData('text/plain', text);
            break;
        }
    }
}
