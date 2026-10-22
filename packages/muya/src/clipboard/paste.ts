import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type { Muya } from '../muya';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import type Clipboard from './index';
import CodeBlockContent from '../block/content/codeBlockContent';
import LangInputContent from '../block/content/langInputContent';
import { ScrollPage } from '../block/scrollPage';
import { tokenizer } from '../inlineRenderer/lexer';
import HtmlToMarkdown from '../state/htmlToMarkdown';
import { MarkdownToState } from '../state/markdownToState';
import { isAnyListState, isParagraphState } from '../state/types';
import { getClipboardImageFile, getCopyTextType, isHttpUrl, isStandaloneTableHtml, normalizePastedHTML } from '../utils/paste';
import { mergePasteIntoHeading } from './mergePasteIntoHeading';
import { tryPasteImage, tryReplaceSelectedImage } from './pasteImage';
import { tryPasteUrl } from './pasteUrl';
import { PasteType } from './types';

// Selection and target captured before any block mutation.
interface IPasteContext {
    anchorBlock: Content;
    wrapperBlock: Nullable<Parent>;
    originWrapperBlock: Nullable<Parent>;
    start: { offset: number };
    end: { offset: number };
    content: string;
}

function isSingleCellSelected(clipboard: Clipboard): boolean {
    const state = clipboard.selection.table.getStateForCopy();
    if (state == null)
        return false;

    return state.children.length === 1 && state.children[0].children.length === 1;
}

function lastLeafState(state: TState): Nullable<{ text: string }> {
    const node = state as { children?: TState[]; text?: string };
    if (Array.isArray(node.children) && node.children.length > 0)
        return lastLeafState(node.children[node.children.length - 1]);

    return typeof node.text === 'string' ? (node as { text: string }) : null;
}

// Return the caret offset before the anchor's trailing text is appended.
function sewTail(states: TState[], tail: string): number {
    const leaf = lastLeafState(states[states.length - 1]);
    if (leaf == null)
        return 0;

    const offset = leaf.text.length;
    if (tail.length > 0)
        leaf.text += tail;

    return offset;
}

function insertStatesAfter(
    muya: Muya,
    wrapperBlock: Nullable<Parent>,
    states: TState[],
): Nullable<Parent> {
    let wb = wrapperBlock;
    for (const state of states) {
        const newBlock = ScrollPage.loadBlock(state.name).create(muya, state);
        wb?.parent?.insertAfter(newBlock, wb);
        wb = newBlock;
    }

    return wb;
}

function removeEmptyOriginWrapper(originWrapperBlock: Nullable<Parent>): void {
    const blockName = originWrapperBlock?.blockName;
    if (
        blockName !== 'paragraph'
        && blockName !== 'atx-heading'
        && blockName !== 'setext-heading'
    ) {
        return;
    }

    const originState = originWrapperBlock!.getState() as { text?: string };
    if (originState.text === '')
        originWrapperBlock!.remove();
}

function isSinglePlainUrl(text: string): boolean {
    return isHttpUrl(text);
}

function canPlainUrlFallbackAutoLink(
    text: string,
    content: string,
    start: { offset: number },
    end: { offset: number },
): boolean {
    const candidate
        = content.substring(0, start.offset)
            + text
            + content.substring(end.offset);

    return tokenizer(candidate, { hasBeginRules: false }).some(token =>
        token.type === 'auto_link_extension'
        && token.linkType === 'url'
        && token.range.start === start.offset
        && token.range.end === start.offset + text.length,
    );
}

function shouldPreserveBareUrlLinkForPaste(
    text: string,
    content: string,
    start: { offset: number },
    end: { offset: number },
): boolean {
    return isSinglePlainUrl(text) && !canPlainUrlFallbackAutoLink(text, content, start, end);
}

function seatCursorAtSeam(last: Nullable<Parent>, offset: number): void {
    last?.lastContentInDescendant()?.setCursor(offset, offset, true);
}

// Paragraphs merge inline; headings merge only into non-empty anchors.
// Return null when the pasted state must start a new block.
function inlineMergeText(state: TState, anchorHasText: boolean): Nullable<string> {
    switch (state.name) {
        case 'paragraph':
            return state.text;
        case 'atx-heading':
            return anchorHasText ? state.text.replace(/^ {0,3}#{1,6}\s+/, '') : null;
        case 'setext-heading':
            return anchorHasText ? state.text : null;
        default:
            return null;
    }
}

// Keep the anchor's trailing text after the entire paste, not after its first line.
function pasteAfterHeading(muya: Muya, ctx: IPasteContext, remaining: TState[], tail: string): void {
    const { anchorBlock } = ctx;

    if (remaining.length === 0) {
        const offset = anchorBlock.text.length;
        if (tail.length > 0) {
            anchorBlock.text += tail;
            anchorBlock.update();
        }
        anchorBlock.setCursor(offset, offset, true);

        return;
    }

    const sewOffset = sewTail(remaining, tail);
    const last = insertStatesAfter(muya, ctx.wrapperBlock, remaining);
    seatCursorAtSeam(last, sewOffset);
}

function pasteInlineMerge(
    muya: Muya,
    ctx: IPasteContext,
    states: TState[],
    mergeText: string,
    head: string,
    tail: string,
): void {
    const { anchorBlock } = ctx;
    const rest = states.slice(1);

    if (rest.length === 0) {
        anchorBlock.text = head + mergeText + tail;
        anchorBlock.update();
        const offset = head.length + mergeText.length;
        anchorBlock.setCursor(offset, offset, true);

        return;
    }

    anchorBlock.text = head + mergeText;
    anchorBlock.update();
    const offset = sewTail(rest, tail);
    const last = insertStatesAfter(muya, ctx.wrapperBlock, rest);
    seatCursorAtSeam(last, offset);
}

function pasteNewline(
    muya: Muya,
    ctx: IPasteContext,
    states: TState[],
    head: string,
    tail: string,
): void {
    const { anchorBlock } = ctx;
    if (anchorBlock.text !== head) {
        anchorBlock.text = head;
        anchorBlock.update();
    }

    const offset = sewTail(states, tail);
    const last = insertStatesAfter(muya, ctx.wrapperBlock, states);
    if (head.length === 0)
        removeEmptyOriginWrapper(ctx.originWrapperBlock);

    seatCursorAtSeam(last, offset);
}

function itemParaContent(list: Parent, itemIndex: number, paraIndex: number): Nullable<Content> {
    const item = list.find(itemIndex) as Parent | undefined;
    const para = item?.find(paraIndex) as Parent | undefined;

    return para?.firstContentInDescendant() ?? null;
}

interface IListMergeSeam {
    foldedOnly: boolean;
    itemIndex: number;
    paraIndex: number;
    head: string;
    sewOffset: number;
    canFold: boolean;
    pastedCount: number;
    trailingStates: TState[];
}

// Seat the caret after a list-merge rebuilds the list block: inside the folded
// paragraph, on trailing non-list content, or on the last pasted item (which is
// spliced in after the anchor, so it is no longer the list's last descendant).
function seatListMergeCursor(muya: Muya, newList: Parent, seam: IListMergeSeam): void {
    const { foldedOnly, itemIndex, paraIndex, head, sewOffset, canFold, pastedCount, trailingStates } = seam;
    if (foldedOnly) {
        const cursor = itemParaContent(newList, itemIndex, paraIndex);
        const offset = head.length + sewOffset;
        cursor?.setCursor(offset, offset, true);

        return;
    }
    if (trailingStates.length > 0) {
        const last = insertStatesAfter(muya, newList, trailingStates);
        seatCursorAtSeam(last, sewOffset);

        return;
    }
    const lastPastedIndex = itemIndex + pastedCount - (canFold ? 1 : 0);
    seatCursorAtSeam(newList.find(lastPastedIndex) as Nullable<Parent>, sewOffset);
}

function listMarkersMatch(a: TState, b: TState): boolean {
    if (a.name === 'order-list' && b.name === 'order-list')
        return a.meta.delimiter === b.meta.delimiter;
    if (a.name === 'bullet-list' && b.name === 'bullet-list')
        return a.meta.marker === b.meta.marker;
    if (a.name === 'task-list' && b.name === 'task-list') {
        if (!!a.meta.ordered !== !!b.meta.ordered)
            return false;

        return a.meta.ordered && b.meta.ordered
            ? a.meta.delimiter === b.meta.delimiter
            : ('marker' in a.meta && 'marker' in b.meta && a.meta.marker === b.meta.marker);
    }

    return false;
}

// Merge matching list kinds and markers into the enclosing list.
// Return false to use ordinary paste when no compatible list exists.
function tryMergeListPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    states: TState[],
    head: string,
    tail: string,
): boolean {
    const firstState = states[0];
    if (!isAnyListState(firstState))
        return false;

    const listItemName = firstState.name === 'task-list' ? 'task-list-item' : 'list-item';
    const listItem = ctx.anchorBlock.closestBlock(listItemName);
    const listBlock = listItem?.parent;
    if (listItem == null || listBlock == null || listBlock.blockName !== firstState.name)
        return false;

    const listState = listBlock.getState();
    if (!isAnyListState(listState) || !listMarkersMatch(listState, firstState))
        return false;

    const itemIndex = listBlock.offset(listItem);
    // Loose list items may contain several paragraphs; merge at the caret paragraph.
    const paraIndex = ctx.wrapperBlock ? (listItem as Parent).offset(ctx.wrapperBlock) : 0;
    const currentItem = listState.children[itemIndex];
    const anchorPara = currentItem?.children[paraIndex];
    if (anchorPara == null || !isParagraphState(anchorPara))
        return false;

    const sewOffset = sewTail(states, tail);
    const pastedItems = firstState.children;
    const pastedFirst = pastedItems[0].children[0];

    // Task lists append every pasted item; bullet and ordered lists merge the first paragraph inline.
    const canFold = firstState.name !== 'task-list' && isParagraphState(pastedFirst);

    const mergedChildren = [...listState.children];
    let foldedOnly = false;
    if (canFold) {
        anchorPara.text = head + pastedFirst.text;
        currentItem.children = [...currentItem.children, ...pastedItems[0].children.slice(1)];
        mergedChildren.splice(itemIndex + 1, 0, ...pastedItems.slice(1));
        foldedOnly
            = pastedItems.length === 1
                && pastedItems[0].children.length === 1
                && states.length === 1;
    }
    else {
        anchorPara.text = head;
        mergedChildren.splice(itemIndex + 1, 0, ...pastedItems);
    }

    const loose = listState.meta.loose || firstState.meta.loose;
    const mergedListState = {
        ...listState,
        meta: { ...listState.meta, loose },
        children: mergedChildren,
    };

    const newList = ScrollPage.loadBlock(mergedListState.name).create(
        clipboard.muya,
        mergedListState,
    );
    listBlock.replaceWith(newList);

    seatListMergeCursor(clipboard.muya, newList as Parent, {
        foldedOnly,
        itemIndex,
        paraIndex,
        head,
        sewOffset,
        canFold,
        pastedCount: pastedItems.length,
        trailingStates: states.slice(1),
    });

    return true;
}

function applyParsedPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    markdown: string,
): void {
    const { muya } = clipboard;
    const { anchorBlock, start, end, content } = ctx;

    // Literal plain-text insertion handles whitespace that block parsing would discard.
    if (markdown.trim().length === 0)
        return;

    const states = new MarkdownToState({
        ...muya.options,
        githubAlerts: muya.options.githubAlerts && ctx.wrapperBlock?.parent?.isScrollPage === true,
    }).generate(markdown);

    if (states.length === 0)
        return;

    const head = content.substring(0, start.offset);
    const tail = content.substring(end.offset);

    const remaining = mergePasteIntoHeading(
        anchorBlock,
        ctx.wrapperBlock,
        states,
        { startOffset: start.offset, endOffset: end.offset },
    );
    if (remaining !== states) {
        pasteAfterHeading(muya, ctx, remaining, tail);

        return;
    }

    if (tryMergeListPaste(clipboard, ctx, states, head, tail))
        return;

    let mergeText = inlineMergeText(states[0], head.length > 0);

    // Pasting into a link destination `[text](|)`: a pasted whole markdown link
    // (e.g. a URL the clipboard delivered as a smart-link `[Title](url)`) must
    // contribute only its URL, otherwise it nests as `[text]([Title](url))`.
    if (mergeText != null && head.endsWith('](') && tail.startsWith(')')) {
        const linkMatch = mergeText.match(/^\[.*?\]\((.*)\)$/);
        if (linkMatch)
            mergeText = linkMatch[1];
    }

    if (mergeText != null)
        pasteInlineMerge(muya, ctx, states, mergeText, head, tail);
    else
        pasteNewline(muya, ctx, states, head, tail);
}

function applyLiteralPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    initialMarkdown: string,
): void {
    const { anchorBlock, start, end, content } = ctx;
    let markdown = initialMarkdown;

    if (
        anchorBlock.blockName === 'table.cell.content'
        && clipboard.selection.table.hasSelection
    ) {
        if (!isSingleCellSelected(clipboard))
            return;

        anchorBlock.text = markdown.trim().replace(/\n/g, '<br/>');
        const offset = anchorBlock.text.length;
        anchorBlock.setCursor(offset, offset, true);
        clipboard.selection.table.clear();

        return;
    }

    // A language input accepts only the first line and must update the owning code block.
    if (anchorBlock.blockName === 'language-input') {
        const firstLine = initialMarkdown.split('\n')[0];
        const newLang
            = content.substring(0, start.offset)
                + firstLine
                + content.substring(end.offset);
        const offset = start.offset + firstLine.length;
        if (anchorBlock instanceof LangInputContent)
            anchorBlock.updateLanguage(newLang);
        else
            anchorBlock.text = newLang;
        anchorBlock.setCursor(offset, offset, true);

        return;
    }

    // Table cells preserve line breaks as <br/> within a single Markdown row.
    if (anchorBlock.blockName === 'table.cell.content')
        markdown = markdown.trim().replace(/\n/g, '<br/>');

    anchorBlock.text
        = content.substring(0, start.offset)
            + markdown
            + content.substring(end.offset);
    const offset = start.offset + markdown.length;
    anchorBlock.setCursor(offset, offset, true);
    if (
        anchorBlock instanceof CodeBlockContent
        && anchorBlock.outContainer
        && /html-block|math-block|diagram/.test(
            anchorBlock.outContainer.blockName,
        )
    ) {
        // The first attachment is the preview; narrow its shape before invoking update.
        const head = anchorBlock.outContainer.attachments.head;
        const updater = head as TreeNode & { update?: (text: string) => void };
        if (typeof updater.update === 'function')
            updater.update(anchorBlock.text);
    }
}

// Plain-text block HTML keeps its first line literal at the caret; remaining lines form an HTML block.
function applyPlainTextBlockHtml(clipboard: Clipboard, ctx: IPasteContext, text: string): void {
    const { anchorBlock, start, end, content } = ctx;
    const head = content.substring(0, start.offset);
    const tail = content.substring(end.offset);
    const lines = text.trim().split('\n');

    anchorBlock.text = head + lines[0] + tail;
    anchorBlock.update();
    const offset = head.length + lines[0].length;
    anchorBlock.setCursor(offset, offset, true);

    if (lines.length === 1)
        return;

    const htmlState = { name: 'html-block', text: lines.slice(1).join('\n') };
    const newBlock = ScrollPage.loadBlock(htmlState.name).create(clipboard.muya, htmlState);
    ctx.wrapperBlock?.parent?.insertAfter(newBlock, ctx.wrapperBlock);
}

// Block-level HTML renders as a live HTML block instead of a fenced code block.
function applyHtmlBlockPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    text: string,
): void {
    const { muya } = clipboard;
    const { wrapperBlock, originWrapperBlock } = ctx;
    const state = {
        name: 'html-block',
        text: text.trim(),
    };
    const newBlock = ScrollPage.loadBlock(state.name).create(muya, state);
    wrapperBlock?.parent?.insertAfter(newBlock, wrapperBlock);

    removeEmptyOriginWrapper(originWrapperBlock);

    const offset = state.text.length;
    newBlock.lastContentInDescendant().setCursor(offset, offset, true);
}

// Clipboard values must be captured before async work can detach the DataTransfer.
interface IPasteData {
    text: string;
    html: string;
    imageFile: File | null;
    pasteType: PasteType;
}

function applyNormalizedPaste(
    clipboard: Clipboard,
    anchorBlock: Content,
    text: string,
    html: string,
    pasteType: PasteType,
): void {
    const { bulletListMarker } = clipboard.muya.options;
    const copyType = getCopyTextType(html, text, pasteType);

    const { start, end } = anchorBlock.getCursor()!;
    const { text: content } = anchorBlock;
    const wrapperBlock = anchorBlock.getAnchor();
    const ctx: IPasteContext = {
        anchorBlock,
        wrapperBlock,
        originWrapperBlock: wrapperBlock,
        start,
        end,
        content,
    };

    if (/html|text/.test(copyType)) {
        const markdown
            = copyType === 'html' && anchorBlock.blockName !== 'codeblock.content'
                ? new HtmlToMarkdown({ bulletListMarker }).generate(html)
                : text;

        // Even a single pasted line can introduce block syntax such as a heading or list.
        const isLiteralAnchor
            = anchorBlock.blockName === 'language-input'
                || anchorBlock.blockName === 'table.cell.content'
                || anchorBlock.blockName === 'codeblock.content';

        const isPlainInlineSpaces = /^ +$/.test(text);

        if (isLiteralAnchor || isPlainInlineSpaces)
            applyLiteralPaste(clipboard, ctx, isPlainInlineSpaces ? text : markdown);
        else
            applyParsedPaste(clipboard, ctx, markdown);
    }
    else if (pasteType === PasteType.PASTE_AS_PLAIN_TEXT) {
        applyPlainTextBlockHtml(clipboard, ctx, text);
    }
    else {
        applyHtmlBlockPaste(clipboard, ctx, text);
    }
}

async function applyPaste(clipboard: Clipboard, data: IPasteData): Promise<void> {
    const target = clipboard.selection.image?.block ?? clipboard.selection.getSelection()?.anchor.block;
    if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(target))
        return;
    // A selected inline image collapses the text selection, so handle the
    // "paste an image over a selected image" replace before reading the
    // (now absent) text selection.
    if (clipboard.selection.image && await tryReplaceSelectedImage(clipboard, data.imageFile))
        return;

    const selection = clipboard.selection.getSelection();
    if (!selection)
        return;

    const { isSelectionInSameBlock, anchor } = selection;
    const anchorBlock = anchor.block;

    if (!anchorBlock || anchorBlock !== target || clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(anchorBlock))
        return;

    const { imageFile, pasteType } = data;
    let { html } = data;
    // Preserve source provenance before synthetic URL/table HTML promotion.
    const hasClipboardHtml = html !== '';
    // Normalize newlines before computing offsets or splitting lines.
    const text = data.text.replace(/\r\n?/g, '\n');

    if (isSelectionInSameBlock && !imageFile && !clipboard.selection.image
        && tryPasteUrl(clipboard, anchorBlock, text, pasteType)) {
        return;
    }

    if (!isSelectionInSameBlock) {
        clipboard.cutHandler();

        return applyPaste(clipboard, data);
    }

    if (await tryPasteImage(clipboard, anchorBlock, imageFile))
        return;

    if (clipboard.muya.isReadOnly || !clipboard.muya.isBlockInDocument(target))
        return;

    // Firefox can supply a pasted URL without HTML.
    if (isHttpUrl(text) && !html) {
        const link = document.createElement('a');
        link.setAttribute('href', text);
        link.textContent = text;
        html = link.outerHTML;
    }

    // Apple Numbers may supply table HTML only in text/plain; route it through HTML conversion.
    if (!html && isStandaloneTableHtml(text))
        html = text;

    const cursorBeforeNormalize = anchorBlock.getCursor();

    html = await normalizePastedHTML(html, {
        fetchLinkHtml: clipboard.muya.options.fetchLinkHtml,
        resolveLinkTitles: pasteType === PasteType.NORMAL,
        preserveBareUrlLinks: hasClipboardHtml
            && cursorBeforeNormalize != null
            && shouldPreserveBareUrlLinkForPaste(
                text,
                anchorBlock.text,
                cursorBeforeNormalize.start,
                cursorBeforeNormalize.end,
            ),
    });
    if (!clipboard.muya.isReadOnly && clipboard.muya.isBlockInDocument(anchorBlock) && anchorBlock.getCursor())
        applyNormalizedPaste(clipboard, anchorBlock, text, html, pasteType);
}

export function pasteSelection(
    clipboard: Clipboard,
    event: ClipboardEvent,
    // DataTransfer is valid only during event dispatch; recursive paste calls reuse this snapshot.
    rawText?: string,
    rawHtml?: string,
): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (!event.clipboardData)
        return Promise.resolve();

    const text = rawText ?? event.clipboardData.getData('text/plain');
    const html = rawHtml ?? event.clipboardData.getData('text/html');
    const imageFile = getClipboardImageFile(event.clipboardData);

    return applyPaste(clipboard, { text, html, imageFile, pasteType: clipboard.pasteType });
}

// Treat the supplied text as Markdown source without synthesizing rich HTML.
export function pastePlainText(clipboard: Clipboard, text: string): Promise<void> {
    return applyPaste(clipboard, {
        text,
        html: '',
        imageFile: null,
        pasteType: PasteType.PASTE_AS_PLAIN_TEXT,
    });
}
