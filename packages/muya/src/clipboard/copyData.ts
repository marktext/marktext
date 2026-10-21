import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type { Muya } from '../muya';
import type { ISelection } from '../selection/types';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import type Clipboard from './index';
import { SelectionDirection } from '../selection/types';
import StateToMarkdown from '../state/stateToMarkdown';
import { githubAlertBlockType } from '../utils/githubAlerts';
import { getClipBoardHtml, getSanitizeClipboardHtml } from '../utils/marked';
import { CopyType } from './types';

export interface IClipboardPayload {
    html: string;
    text: string;
}

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

function firstAlertBodyContent(container: Parent) {
    const first = container.firstContentInDescendant();
    return first?.blockName === 'language-input' ? first.nextContentInContext() : first;
}

function buildHtmlOptions(options: Muya['options']) {
    const {
        footnote,
        frontMatter = true,
        texMathDollars,
        texMathGfm,
        texMathSingleBackslash,
        texMathDoubleBackslash,
        superSubScript,
        highlightSyntax,
        inlineDiff,
        multilineBlockquote,
        githubAlerts,
    } = options;

    return { footnote, frontMatter, texMathDollars, texMathGfm, texMathSingleBackslash, texMathDoubleBackslash, superSubScript, highlightSyntax, inlineDiff, multilineBlockquote, githubAlerts };
}

// A single selected cell copies literal text; larger rectangles copy GFM table Markdown.
// Return null without a frozen table selection.
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

function resolveSelectionOrder(
    selection: ISelection,
): ICopyOrder {
    const { anchor, focus } = selection;
    const anchorBlock = anchor.block;
    const focusBlock = focus.block;
    const anchorOutMostBlock = anchorBlock.outMostBlock!;
    const focusOutMostBlock = focusBlock.outMostBlock!;
    const anchorFirst = selection.direction === SelectionDirection.FORWARD;

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

// Truncate a leaf block's state (paragraph, heading, …) to the selected side
// of `offset`. Keeps the head (`0..offset`) for an end edge, the tail
// (`offset..`) for a start edge.
function truncateLeafState(
    leafState: TState,
    leaf: Content,
    offset: number,
    position: 'start' | 'end',
): TState {
    const text
        = position === 'start'
            ? leaf.text.substring(offset)
            : leaf.text.substring(0, offset);

    return { ...leafState, text } as TState;
}

// Copy only the selected side of a container, including a truncated boundary leaf.
function buildPartialContainerState(
    container: Parent,
    leaf: Content,
    offset: number,
    position: 'start' | 'end',
): TState {
    const fullState = container.getState() as TState & { children?: TState[] };
    const childStates = fullState.children;
    if (childStates == null)
        return truncateLeafState(fullState, leaf, offset, position);

    const childBlocks = container.children.map(child => child);
    const idx = childBlocks.findIndex(
        child => child === leaf || leaf.isInBlock(child as Parent),
    );
    if (idx < 0)
        return fullState;

    const boundaryChild = childBlocks[idx];
    const boundaryFullState = childStates[idx] as TState & { children?: TState[] };
    const boundaryState
        = boundaryFullState.children != null
            ? buildPartialContainerState(boundaryChild as Parent, leaf, offset, position)
            : truncateLeafState(boundaryFullState, leaf, offset, position);

    const keptChildren
        = position === 'start'
            ? [boundaryState, ...childStates.slice(idx + 1)]
            : [...childStates.slice(0, idx), boundaryState];

    return { ...fullState, children: keptChildren } as TState;
}

// Copy the selected range within one container, truncating both boundary leaves.
function buildRangeContainerState(
    container: Parent,
    startLeaf: Content,
    startOffset: number,
    endLeaf: Content,
    endOffset: number,
): TState {
    const fullState = container.getState() as TState & { children?: TState[] };
    const childStates = fullState.children;
    if (childStates == null) {
        // A leaf-text block with both boundaries in the same content leaf:
        // truncate to the selected span. When the boundaries are in different
        // leaves of the same block (e.g. a code fence's language line and its
        // body), there is no single text to slice — copy the whole block.
        if (startLeaf !== endLeaf)
            return fullState;

        return {
            ...fullState,
            text: startLeaf.text.substring(startOffset, endOffset),
        } as TState;
    }

    const childBlocks = container.children.map(child => child);
    const startIdx = childBlocks.findIndex(
        child => child === startLeaf || startLeaf.isInBlock(child as Parent),
    );
    const endIdx = childBlocks.findIndex(
        child => child === endLeaf || endLeaf.isInBlock(child as Parent),
    );
    if (startIdx < 0 || endIdx < 0)
        return fullState;

    if (startIdx === endIdx) {
        const child = childBlocks[startIdx];
        const childFull = childStates[startIdx] as TState & { children?: TState[] };
        const childState
            = childFull.children != null
                ? buildRangeContainerState(child as Parent, startLeaf, startOffset, endLeaf, endOffset)
                : { ...childFull, text: startLeaf.text.substring(startOffset, endOffset) } as TState;

        return { ...fullState, children: [childState] } as TState;
    }

    const startChildFull = childStates[startIdx] as TState & { children?: TState[] };
    const startState
        = startChildFull.children != null
            ? buildPartialContainerState(childBlocks[startIdx] as Parent, startLeaf, startOffset, 'start')
            : truncateLeafState(startChildFull, startLeaf, startOffset, 'start');

    const endChildFull = childStates[endIdx] as TState & { children?: TState[] };
    const endState
        = endChildFull.children != null
            ? buildPartialContainerState(childBlocks[endIdx] as Parent, endLeaf, endOffset, 'end')
            : truncateLeafState(endChildFull, endLeaf, endOffset, 'end');

    return {
        ...fullState,
        children: [startState, ...childStates.slice(startIdx + 1, endIdx), endState],
    } as TState;
}

function appendPartialState(
    copyState: TState[],
    order: ICopyOrder,
    position: 'start' | 'end',
): void {
    const { startOutBlock, endOutBlock, startBlock, endBlock, startOffset, endOffset } = order;
    const outBlock = position === 'start' ? startOutBlock : endOutBlock;
    const block = position === 'start' ? startBlock : endBlock;
    const offset = position === 'start' ? startOffset : endOffset;

    if (outBlock && githubAlertBlockType(outBlock)) {
        const edge = position === 'start' ? firstAlertBodyContent(outBlock) : outBlock.lastContentInDescendant();
        if (edge === block && offset === (position === 'start' ? 0 : block.text.length)) {
            copyState.push(outBlock.getState());
            return;
        }
    }

    if (/github-alert|block-quote|bullet-list|order-list|task-list/.test(outBlock!.blockName)) {
        copyState.push(
            buildPartialContainerState(outBlock as Parent, block, offset, position),
        );

        return;
    }

    const truncated
        = position === 'start'
            ? block.text.substring(offset)
            : block.text.substring(0, offset);

    // Blocks whose marker lives in meta, not in the text: setext heading (its
    // `===`/`---` underline) and the code-family (code-block, html-block,
    // math-block, frontmatter, diagram fences/wrappers). Keep the block's own
    // type + meta and truncate only its text — the serializer rebuilds the
    // marker from meta. A fully-selected endpoint keeps the whole block. A code
    // fence's language line has no place in the body text, so copy it whole.
    if (
        /setext-heading|code-block|html-block|math-block|frontmatter|diagram/.test(outBlock!.blockName)
        && block.blockName !== 'language-input'
    ) {
        if (truncated.length === 0)
            return;
        copyState.push({ ...(outBlock as Parent).getState(), text: truncated } as TState);

        return;
    }

    if (outBlock!.blockName === 'table' || block.blockName === 'language-input') {
        copyState.push((outBlock as Parent).getState());

        return;
    }

    // ATX markers live in text, so only selected hashes survive copying as a paragraph.
    if (truncated.length === 0)
        return;

    copyState.push({ name: 'paragraph', text: truncated });
}

function collectSameOutMostBlockState(order: ICopyOrder): TState[] {
    const { anchorOutMostBlock, startBlock, endBlock, startOffset, endOffset } = order;
    const copyState: TState[] = [];

    // A table is copied whole (its own cross-cell selection path handles
    // partial rectangles elsewhere).
    if (anchorOutMostBlock!.blockName === 'table') {
        copyState.push((anchorOutMostBlock as Parent).getState());

        return copyState;
    }

    if (githubAlertBlockType(anchorOutMostBlock)) {
        const partial = buildRangeContainerState(anchorOutMostBlock, startBlock, startOffset, endBlock, endOffset);
        if (partial.name === 'github-alert')
            return partial.children;
    }

    copyState.push(
        buildRangeContainerState(
            anchorOutMostBlock as Parent,
            startBlock,
            startOffset,
            endBlock,
            endOffset,
        ),
    );

    return copyState;
}

function collectCopyState(order: ICopyOrder): TState[] {
    const { anchorOutMostBlock, focusOutMostBlock, startOutBlock, endOutBlock } = order;

    if (anchorOutMostBlock === focusOutMostBlock)
        return collectSameOutMostBlockState(order);

    const copyState: TState[] = [];
    appendPartialState(copyState, order, 'start');
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
    const container = anchorBlock.outMostBlock;
    if (container && container === focusBlock.outMostBlock && githubAlertBlockType(container)) {
        const first = firstAlertBodyContent(container);
        const last = container.lastContentInDescendant();
        const forward = anchorBlock === first && anchor.offset === 0 && focusBlock === last && focus.offset === last.text.length;
        const backward = focusBlock === first && focus.offset === 0 && anchorBlock === last && anchor.offset === last.text.length;
        if (forward || backward) {
            const text = new StateToMarkdown().generate([container.getState()]);
            return { text, html: getClipBoardHtml(text, options) };
        }
    }

    if (isSelectionInSameBlock) {
        const begin = Math.min(anchor.offset, focus.offset);
        const end = Math.max(anchor.offset, focus.offset);

        const text = anchorBlock.text.substring(begin, end);

        return { html: getClipBoardHtml(text, options), text };
    }

    const order = resolveSelectionOrder(selection);

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

    // Preserve the system clipboard when there is nothing to copy (#3130).
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
