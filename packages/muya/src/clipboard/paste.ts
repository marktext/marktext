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
import { URL_REG } from '../config';
import { tokenizer } from '../inlineRenderer/lexer';
import HtmlToMarkdown from '../state/htmlToMarkdown';
import { MarkdownToState } from '../state/markdownToState';
import { isAnyListState, isParagraphState } from '../state/types';
import { getClipboardImageFile, getCopyTextType, isStandaloneTableHtml, normalizePastedHTML } from '../utils/paste';
import { mergePasteIntoHeading } from './mergePasteIntoHeading';
import { tryPasteImage, tryReplaceSelectedImage } from './pasteImage';
import { PasteType } from './types';

// Everything the per-anchor paste handlers need from the synchronous snapshot
// taken before any block mutation: the target leaf, its wrapper block, and the
// current selection range.
interface IPasteContext {
    anchorBlock: Content;
    wrapperBlock: Nullable<Parent>;
    originWrapperBlock: Nullable<Parent>;
    start: { offset: number };
    end: { offset: number };
    content: string;
}

/**
 * Whether the frozen table-cell selection covers exactly one cell. Mirrors
 * the single-cell shape check used by the copy path: one row containing one
 * cell. Used to decide between replacing a single cell's text and cancelling
 * a multi-cell paste.
 */
function isSingleCellSelected(clipboard: Clipboard): boolean {
    const state = clipboard.selection.table.getStateForCopy();
    if (state == null)
        return false;

    return state.children.length === 1 && state.children[0].children.length === 1;
}

// The deepest last text-bearing leaf of a parsed state (a paragraph inside a
// list / quote), used to sew the anchor's trailing text onto the last block.
function lastLeafState(state: TState): Nullable<{ text: string }> {
    const node = state as { children?: TState[]; text?: string };
    if (Array.isArray(node.children) && node.children.length > 0)
        return lastLeafState(node.children[node.children.length - 1]);

    return typeof node.text === 'string' ? (node as { text: string }) : null;
}

// Append the anchor's trailing text onto the last pasted block; return the caret
// offset (the length before the sewn tail) inside that leaf.
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

// Drop the anchor's wrapper when the paste emptied it. muyajs removes any
// emptied wrapper (removeBlock), so a heading whose text was consumed is
// cleaned up too — not just a paragraph.
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
    return URL_REG.test(text) && !/\s/.test(text);
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

// muyajs `checkPasteType`: a paragraph always merges inline into the anchor; a
// heading merges (with its marker dropped) only into a non-empty anchor;
// anything else starts a new block. Returns the inline text to merge, or null
// for the NEWLINE path.
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

// Heading anchor: the first line was spliced into the heading; insert the rest
// as blocks below. The anchor's tail is sewn onto the last pasted block so it
// trails the whole paste (muyajs `pasteCtrl`); only when nothing follows does
// it stay in the heading.
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

// MERGE: splice the first state's text into the anchor (head + pasted), sewing
// the anchor's tail onto the last pasted block — or back onto the anchor when
// the paste is a single state.
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

// NEWLINE: the first state cannot merge into the anchor — insert every state as
// a new block, sewing the tail onto the last and dropping an emptied anchor.
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

// The content leaf of the `paraIndex`-th block inside the `itemIndex`-th list
// item — used to seat the caret after a list-merge rebuilds the list block.
function itemParaContent(list: Parent, itemIndex: number, paraIndex: number): Nullable<Content> {
    const item = list.find(itemIndex) as Parent | undefined;
    const para = item?.find(paraIndex) as Parent | undefined;

    return para?.firstContentInDescendant() ?? null;
}

// Same list kind + same bullet marker / order delimiter.
function listMarkersMatch(a: TState, b: TState): boolean {
    if (a.name === 'order-list' && b.name === 'order-list')
        return a.meta.delimiter === b.meta.delimiter;
    if (a.name === 'bullet-list' && b.name === 'bullet-list')
        return a.meta.marker === b.meta.marker;
    if (a.name === 'task-list' && b.name === 'task-list')
        return a.meta.marker === b.meta.marker;

    return false;
}

// A5: pasting a same-kind, same-marker list into a list item merges it into the
// enclosing list (muyajs `pasteCtrl` LIST MERGE) — the first pasted item folds
// inline into the current item, the rest append to the list, and loose/tight
// reconcile (`a.loose || b.loose`). Returns false to fall through to a normal
// paste (no enclosing list, or a mismatched kind/marker).
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
    // The cursor lives in a specific paragraph of the item — not necessarily the
    // first (loose list items hold several blocks). Merge into that paragraph.
    const paraIndex = ctx.wrapperBlock ? (listItem as Parent).offset(ctx.wrapperBlock) : 0;
    const currentItem = listState.children[itemIndex];
    const anchorPara = currentItem?.children[paraIndex];
    if (anchorPara == null || !isParagraphState(anchorPara))
        return false;

    // Sew the anchor's tail onto the last pasted leaf; the head stays here.
    const sewOffset = sewTail(states, tail);
    const pastedItems = firstState.children;
    const pastedFirst = pastedItems[0].children[0];

    // A task list never folds its first item: muyajs prepends an `input` child
    // so its `liChildren[0].type === 'p'` check is false and it appends every
    // pasted item. Bullet/order lists fold the first item's paragraph inline.
    const canFold = firstState.name !== 'task-list' && isParagraphState(pastedFirst);

    const mergedChildren = [...listState.children];
    let foldedOnly = false;
    if (canFold) {
        anchorPara.text = head + pastedFirst.text;
        currentItem.children = [...currentItem.children, ...pastedItems[0].children.slice(1)];
        mergedChildren.push(...pastedItems.slice(1));
        // The whole paste folded into `anchorPara` (no extra blocks/items): the
        // caret stays in that paragraph at the seam.
        foldedOnly
            = pastedItems.length === 1
                && pastedItems[0].children.length === 1
                && states.length === 1;
    }
    else {
        anchorPara.text = head;
        mergedChildren.push(...pastedItems);
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

    if (foldedOnly) {
        const cursor = itemParaContent(newList, itemIndex, paraIndex);
        const offset = head.length + sewOffset;
        cursor?.setCursor(offset, offset, true);
    }
    else {
        const last = insertStatesAfter(clipboard.muya, newList, states.slice(1));
        seatCursorAtSeam(last, sewOffset);
    }

    return true;
}

// Parse a paste into real blocks. A heading anchor keeps the first line; a
// same-kind list merges into the enclosing list; otherwise a non-heading anchor
// merges the first paragraph/heading inline (head + pasted + tail) or, for
// non-mergeable content, starts new blocks below.
function applyParsedPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    markdown: string,
): void {
    const { muya } = clipboard;
    const { anchorBlock, start, end, content } = ctx;

    // An empty / whitespace-only paste is a no-op while parsing; non-empty
    // inline whitespace from text/plain is routed through literal insertion.
    if (markdown.trim().length === 0)
        return;

    const {
        footnote,
        math,
        isGitlabCompatibilityEnabled,
        trimUnnecessaryCodeBlockEmptyLines,
        frontMatter,
    } = muya.options;

    const states = new MarkdownToState({
        footnote,
        math,
        isGitlabCompatibilityEnabled,
        trimUnnecessaryCodeBlockEmptyLines,
        frontMatter,
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

// `language-input`, `table.cell.content` and `codeblock.content` never parse a
// paste into blocks — they take the text literally.
function applyLiteralPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    initialMarkdown: string,
): void {
    const { anchorBlock, start, end, content } = ctx;
    let markdown = initialMarkdown;

    // A frozen table-cell selection scopes the paste: a single cell gets its
    // text replaced (with `\n` → `<br/>`); a multi-cell rectangle cancels the
    // paste.
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

    // language-input: only the first line is the language; propagate it to the
    // code block (re-highlight + language selector) rather than splicing raw.
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

    // A table cell holds a single visual line: trim and fold newlines to
    // `<br/>` (muyajs trims pasted cell text on both the framed and normal path).
    if (anchorBlock.blockName === 'table.cell.content')
        markdown = markdown.trim().replace(/\n/g, '<br/>');

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
        // The attachments list of html-block / math-block / diagram blocks
        // always opens with the render preview node, which exposes an
        // `update(text)` method. The LinkedList itself is typed loosely;
        // narrow via a structural shape check before calling.
        const head = anchorBlock.outContainer.attachments.head;
        const updater = head as TreeNode & { update?: (text: string) => void };
        if (typeof updater.update === 'function')
            updater.update(anchorBlock.text);
    }
}

// A8: under Paste as Plain Text, block-level HTML follows muyajs's
// `pasteAsPlainText` copyAsHtml branch — its first line folds into the anchor as
// literal text (the open tag stays visible at the seam), and any remaining lines
// become a single live html-block below, matching muyajs's
// `createBlockP(lines.slice(1).join('\n')) + insertHtmlBlock`.
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

// Block-level HTML (`<ul>`/`<ol>`/`<pre>`/`<blockquote>` … — tags in
// `PARAGRAPH_TYPES`) lands as a live html-block, not a fenced ```html code
// block, so the markup renders in place.
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

    // Drop the empty wrapper the html-block replaced.
    removeEmptyOriginWrapper(originWrapperBlock);

    const offset = state.text.length;
    newBlock.lastContentInDescendant().setCursor(offset, offset, true);
}

// Everything the paste pipeline needs, snapshotted up front so it survives the
// async hops (image hook, HTML normalization) without re-reading a possibly
// detached clipboard.
interface IPasteData {
    text: string;
    html: string;
    imageFile: File | null;
    pasteType: PasteType;
}

// The paste pipeline, decoupled from the DOM `paste` event so it can be driven
// either by a trusted paste event (`pasteSelection`) or by an explicit
// clipboard read (`pastePlainText`). The latter exists because Chromium removed
// programmatic clipboard reads via `document.execCommand('paste')`, so the
// "set a flag → execCommand('paste') → handle the synthetic event" approach no
// longer fires any paste event at all.
async function applyPaste(clipboard: Clipboard, data: IPasteData): Promise<void> {
    const { muya } = clipboard;
    const { bulletListMarker } = muya.options;

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

    if (!anchorBlock)
        return;

    const { imageFile, pasteType } = data;
    let { html } = data;
    // Preserve source provenance before synthetic URL/table HTML promotion.
    const hasClipboardHtml = html !== '';
    // Normalize Windows CRLF / lone CR to LF so every downstream `split('\n')`
    // and offset calculation sees one newline convention (muyajs strips \r).
    const text = data.text.replace(/\r\n?/g, '\n');

    if (!isSelectionInSameBlock) {
        clipboard.cutHandler();

        return applyPaste(clipboard, data);
    }

    // When the clipboard holds an image — either a file resolved to a path
    // or an in-memory bitmap — insert it as an inline image
    // routed through `imageAction`, short-circuiting the text/HTML paste.
    if (await tryPasteImage(clipboard, anchorBlock, imageFile))
        return;

    // Support pasted URLs from Firefox.
    if (URL_REG.test(text) && !/\s/.test(text) && !html)
        html = `<a href="${text}">${text}</a>`;

    // Apple Numbers and a handful of other sources only put a raw
    // `<table>...</table>` blob in text/plain. Promote it to the HTML
    // slot so it goes through the HTML→Markdown converter rather than
    // being inserted verbatim.
    if (!html && isStandaloneTableHtml(text))
        html = text;

    const cursorBeforeNormalize = anchorBlock.getCursor();

    // Remove crap from HTML such as meta data and styles.
    html = await normalizePastedHTML(html, {
        preserveBareUrlLinks: hasClipboardHtml
            && cursorBeforeNormalize != null
            && shouldPreserveBareUrlLinkForPaste(
                text,
                anchorBlock.text,
                cursorBeforeNormalize.start,
                cursorBeforeNormalize.end,
            ),
    });
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

        // Every non-literal anchor always parses through `MarkdownToState`,
        // regardless of line count, so a single line of `# heading` / `- list`
        // / a one-row table becomes real structure.
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
        // Paste as Plain Text inserts block-level HTML as literal text, not a
        // live html-block (muyajs `pasteAsPlainText` copyAsHtml branch).
        applyPlainTextBlockHtml(clipboard, ctx, text);
    }
    else {
        applyHtmlBlockPaste(clipboard, ctx, text);
    }
}

// Entry for a trusted DOM `paste` event (native Cmd/Ctrl+V).
export function pasteSelection(
    clipboard: Clipboard,
    event: ClipboardEvent,
    // `event.clipboardData` is only valid synchronously while the paste event
    // is being dispatched. Once the pipeline yields at its first `await`, the
    // browser may detach the DataTransfer and subsequent `getData()` calls
    // return ''. We snapshot text/html/image synchronously below; the snapshot
    // is then threaded through the `!isSelectionInSameBlock` recursion inside
    // `applyPaste` rather than re-reading the (now possibly detached) clipboard.
    rawText?: string,
    rawHtml?: string,
): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (!event.clipboardData)
        return Promise.resolve();

    const text = rawText ?? event.clipboardData.getData('text/plain');
    const html = rawHtml ?? event.clipboardData.getData('text/html');
    // Snapshot any in-memory image File (the bitmap / "Copy Image" /
    // screenshot case) synchronously too — `clipboardData.files` is also
    // detached after the first `await`.
    const imageFile = getClipboardImageFile(event.clipboardData);

    return applyPaste(clipboard, { text, html, imageFile, pasteType: clipboard.pasteType });
}

// Entry for "Paste as Plain Text". The caller has already read the clipboard's
// plain text (Chromium no longer fires a paste event for
// `document.execCommand('paste')`), so feed it straight into the pipeline with
// the plain-text flag and no HTML — the text is treated as markdown source
// rather than being synthesized from rich HTML.
export function pastePlainText(clipboard: Clipboard, text: string): Promise<void> {
    return applyPaste(clipboard, {
        text,
        html: '',
        imageFile: null,
        pasteType: PasteType.PASTE_AS_PLAIN_TEXT,
    });
}
