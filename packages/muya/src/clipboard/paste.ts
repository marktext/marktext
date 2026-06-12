import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type { Nullable } from '../types';
import type Clipboard from './index';
import CodeBlockContent from '../block/content/codeBlockContent';
import { ScrollPage } from '../block/scrollPage';
import { URL_REG } from '../config';
import HtmlToMarkdown from '../state/htmlToMarkdown';
import { MarkdownToState } from '../state/markdownToState';
import { isParagraphState } from '../state/types';
import { getClipboardImageFile, getCopyTextType, isStandaloneTableHtml, normalizePastedHTML } from '../utils/paste';
import { mergePasteIntoHeading } from './mergePasteIntoHeading';
import { tryPasteImage } from './pasteImage';

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

// Parse a paste into real blocks (the common anchor case): parse markdown →
// state, splice a leading paragraph back into a heading anchor, drop the
// selected range, insert the new blocks, remove the emptied source paragraph,
// and seat the cursor at the end.
function applyParsedPaste(
    clipboard: Clipboard,
    ctx: IPasteContext,
    markdown: string,
): void {
    const { muya } = clipboard;
    const { anchorBlock, originWrapperBlock, start, end, content } = ctx;
    let wrapperBlock = ctx.wrapperBlock;

    // An empty / whitespace-only paste is a no-op; the parser would otherwise
    // emit a lone empty paragraph and churn blocks.
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

    // When pasting into a heading, splice the first paragraph back into the
    // heading text so the heading semantics survive. The helper also collapses
    // any selection on the heading.
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

    // Drop the empty paragraph the html-block replaced.
    if (originWrapperBlock?.blockName === 'paragraph') {
        const originState = originWrapperBlock.getState();
        if (isParagraphState(originState) && originState.text === '')
            originWrapperBlock.remove();
    }

    const offset = state.text.length;
    newBlock.lastContentInDescendant().setCursor(offset, offset, true);
}

export async function pasteSelection(
    clipboard: Clipboard,
    event: ClipboardEvent,
    // `event.clipboardData` is only valid synchronously while the paste
    // event is being dispatched. Once `pasteSelection` yields at its first
    // `await` (the `clipboardFilePath` hook), the browser may detach the
    // DataTransfer and subsequent `getData()` calls return ''. We snapshot
    // text/html synchronously below and thread the snapshot through the
    // `!isSelectionInSameBlock` recursion via these optional params so the
    // re-entry doesn't read a detached clipboard.
    rawText?: string,
    rawHtml?: string,
): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    const { muya } = clipboard;
    const { bulletListMarker } = muya.options;
    const selection = clipboard.selection.getSelection();
    if (!selection)
        return;

    const { isSelectionInSameBlock, anchorBlock } = selection;

    if (!anchorBlock || !event.clipboardData)
        return;

    // Snapshot everything we need from `event.clipboardData` synchronously,
    // BEFORE any `await` — after the first yield the DataTransfer can be
    // detached and `getData()` returns ''. On the `!isSelectionInSameBlock`
    // recursion we reuse the snapshot captured by the outer call rather than
    // re-reading the (now possibly detached) clipboard.
    const text = rawText ?? event.clipboardData.getData('text/plain');
    let html = rawHtml ?? event.clipboardData.getData('text/html');
    // Snapshot any in-memory image File (the bitmap / "Copy Image" /
    // screenshot case) synchronously too — `clipboardData.files`
    // is also detached after the first `await`.
    const imageFile = getClipboardImageFile(event.clipboardData);

    if (!isSelectionInSameBlock) {
        clipboard.cutHandler();

        return clipboard.pasteHandler(event, text, html);
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

    // Remove crap from HTML such as meta data and styles.
    html = await normalizePastedHTML(html);
    const copyType = getCopyTextType(html, text, clipboard.pasteType);

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

        if (!isLiteralAnchor)
            applyParsedPaste(clipboard, ctx, markdown);
        else
            applyLiteralPaste(clipboard, ctx, markdown);
    }
    else {
        applyHtmlBlockPaste(clipboard, ctx, text);
    }
}
