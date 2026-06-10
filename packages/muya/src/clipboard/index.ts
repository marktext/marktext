import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type TreeNode from '../block/base/treeNode';
import type TableCellSelection from '../editor/tableCellSelection';
import type { Muya } from '../muya';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import { fromEvent, merge } from 'rxjs';
import CodeBlockContent from '../block/content/codeBlockContent';
import { ScrollPage } from '../block/scrollPage';
import { URL_REG } from '../config';
import emptyStates from '../config/emptyStates';
import HtmlToMarkdown from '../state/htmlToMarkdown';
import { MarkdownToState } from '../state/markdownToState';
import StateToMarkdown from '../state/stateToMarkdown';
import { isAnyListState, isParagraphState } from '../state/types';
import { deepClone, isClipboardEvent, isKeyboardEvent } from '../utils';
import { getClipBoardHtml } from '../utils/marked';
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
        const { html, text } = this.getClipboardData();

        const { copyType } = this;

        if (!event.clipboardData)
            return;

        // Mirror native copy behaviour: leave the system clipboard untouched
        // when the selection has nothing to contribute, so a previous copy
        // from another app isn't silently clobbered (marktext #3130).
        switch (copyType) {
            case 'normal': {
                if (text.length === 0)
                    return;
                event.clipboardData.setData('text/html', html);
                event.clipboardData.setData('text/plain', text);
                break;
            }

            case 'copyAsHtml': {
                if (html.length === 0)
                    return;
                event.clipboardData.setData('text/html', '');
                event.clipboardData.setData('text/plain', html);
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
        // A frozen cross-cell table selection: empty just those cells in place
        // (legacy `deleteSelectedTableCells`). The copy half already captured
        // the rectangle's markdown via `getClipboardData`.
        if (this.tableSelection?.hasSelection) {
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

        const anchorOutMostBlock = anchorBlock.outMostBlock;
        const focusOutMostBlock = focusBlock.outMostBlock;

        const startOutBlock
            = direction === 'forward' ? anchorOutMostBlock : focusOutMostBlock;
        const endOutBlock
            = direction === 'forward' ? focusOutMostBlock : anchorOutMostBlock;

        if (startOutBlock == null || endOutBlock == null)
            return;

        const startBlock = direction === 'forward' ? anchorBlock : focusBlock;
        const endBlock = direction === 'forward' ? focusBlock : anchorBlock;
        const startOffset = direction === 'forward' ? anchor.offset : focus.offset;
        const endOffset = direction === 'forward' ? focus.offset : anchor.offset;
        let cursorBlock: Nullable<Content> = null;
        let cursorOffset;

        const removePartial = (position: 'start' | 'end') => {
            const outBlock = position === 'start' ? startOutBlock : endOutBlock;
            const block = position === 'start' ? startBlock : endBlock;
            // Handle anchor and focus in different blocks
            if (
                /block-quote|code-block|html-block|table|math-block|frontmatter|diagram/.test(
                    outBlock.blockName,
                )
            ) {
                if (position === 'start') {
                    const state
                        = outBlock.blockName === 'block-quote'
                            ? deepClone(emptyStates['block-quote'])
                            : deepClone(emptyStates.paragraph);
                    const newBlock = ScrollPage.loadBlock(state.name).create(this.muya, state);
                    outBlock.replaceWith(newBlock);
                    cursorBlock = newBlock.firstContentInDescendant();
                    cursorOffset = 0;
                }
                else {
                    outBlock.remove();
                }
            }
            else if (/bullet-list|order-list|task-list/.test(outBlock.blockName)) {
                const listItemBlockName
                    = outBlock.blockName === 'task-list' ? 'task-list-item' : 'list-item';
                const listItem = block.farthestBlock(listItemBlockName)!;
                const offset = outBlock.offset(listItem);
                outBlock.forEach((item, index) => {
                    if (position === 'start' && index === offset) {
                        const state = {
                            name: listItemBlockName,
                            children: [
                                {
                                    name: 'paragraph',
                                    text: '',
                                },
                            ],
                        };
                        const newListItem = ScrollPage.loadBlock(state.name).create(
                            this.muya,
                            state,
                        );
                        (item as Parent).replaceWith(newListItem);
                        cursorBlock = newListItem.firstContentInDescendant();
                        cursorOffset = 0;
                    }
                    else if (
                        (position === 'start' && index > offset)
                        || (position === 'end' && index <= offset)
                    ) {
                        if (item.isOnlyChild())
                            outBlock.remove();
                        else item.remove();
                    }
                });
            }
            else {
                if (position === 'start') {
                    startBlock.text = startBlock.text.substring(0, startOffset);
                    cursorBlock = startBlock;
                    cursorOffset = startOffset;
                }
                else if (position === 'end') {
                    if (cursorBlock) {
                        cursorBlock.text += endBlock.text.substring(endOffset);
                        endOutBlock.remove();
                    }
                }
            }
        };

        if (anchorOutMostBlock === focusOutMostBlock) {
            // Handle anchor and focus in same list\quote block
            if (anchorOutMostBlock?.blockName === 'block-quote') {
                const state = deepClone(emptyStates['block-quote']);
                const newQuoteBlock = ScrollPage.loadBlock(state.name).create(this.muya, state);
                anchorOutMostBlock.replaceWith(newQuoteBlock);
                cursorBlock = newQuoteBlock.firstContentInDescendant();
                cursorOffset = 0;
            }
            else if (anchorOutMostBlock?.blockName === 'table') {
                const state = {
                    name: 'paragraph',
                    text: '',
                };
                const newBlock = ScrollPage.loadBlock(state.name).create(
                    this.muya,
                    state,
                );
                anchorOutMostBlock.replaceWith(newBlock);
                cursorBlock = newBlock.firstContentInDescendant();
                cursorOffset = 0;
            }
            else {
                const listItemBlockName
                    = anchorOutMostBlock?.blockName === 'task-list'
                        ? 'task-list-item'
                        : 'list-item';
                const anchorFarthestListItem
                    = anchorBlock.farthestBlock(listItemBlockName)!;
                const focusFarthestListItem
                    = focusBlock.farthestBlock(listItemBlockName)!;
                const anchorOffset = anchorOutMostBlock?.offset(anchorFarthestListItem);
                const focusOffset = anchorOutMostBlock?.offset(focusFarthestListItem);

                if (anchorOffset == null || focusOffset == null)
                    return;

                const minOffset = Math.min(anchorOffset, focusOffset);
                const maxOffset = Math.max(anchorOffset, focusOffset);
                anchorOutMostBlock?.forEach((item, index) => {
                    if (index === minOffset) {
                        const state = {
                            name: listItemBlockName,
                            children: [
                                {
                                    name: 'paragraph',
                                    text: '',
                                },
                            ],
                        };
                        const newListItem = ScrollPage.loadBlock(state.name).create(
                            this.muya,
                            state,
                        );
                        (item as Parent).replaceWith(newListItem);
                        cursorBlock = newListItem.firstContentInDescendant();
                        cursorOffset = 0;
                    }
                    else if (index > minOffset && index <= maxOffset) {
                        item.remove();
                    }
                });
            }
        }
        else {
            removePartial('start');
            // Get State between the start outmost block and the end outmost block.
            let node = startOutBlock.next;
            while (node && node !== endOutBlock) {
                const temp = node.next;
                node.remove();
                node = temp;
            }
            removePartial('end');
        }

        if (cursorBlock && cursorOffset != null)
            cursorBlock.setCursor(cursorOffset, cursorOffset, true);

        if (this.scrollPage?.length() === 0) {
            const state = {
                name: 'paragraph',
                text: '',
            };

            const newParagraphBlock = ScrollPage.loadBlock('paragraph').create(
                this.muya,
                state,
            );
            this.scrollPage.append(newParagraphBlock, 'user');
            cursorBlock = newParagraphBlock.firstContentInDescendant();

            cursorBlock && cursorBlock.setCursor(0, 0, true);
        }
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

            if (
                /\n\n/.test(markdown)
                && anchorBlock.blockName !== 'codeblock.content'
            ) {
                // Has multiple paragraphs.
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
            const state = {
                name: 'code-block',
                meta: {
                    type: 'fenced',
                    lang: 'html',
                },
                text,
            };
            const newBlock = ScrollPage.loadBlock(state.name).create(muya, state);
            wrapperBlock?.parent?.insertAfter(newBlock, wrapperBlock);
            const offset = text.length;

            newBlock.lastContentInDescendant().setCursor(offset, offset, true);
        }
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
     * `imageAction` first so the user's insert preference (copy-to-assets /
     * upload / keep-path) applies and a portable src is written. `src` is
     * either a resolved clipboard file path (PG06) or a `data:` URL for an
     * in-memory bitmap (PG05). When no `imageAction` is configured the src is
     * inserted as-is, preserving the legacy file-path behaviour.
     */
    private async insertImageSrc(anchorBlock: Content, src: string): Promise<void> {
        let finalSrc = src;
        const { imageAction } = this.muya.options;
        if (imageAction) {
            const resolved = await imageAction({ src, alt: '', title: '' });
            if (resolved)
                finalSrc = resolved;
        }

        this.insertImageText(anchorBlock, finalSrc);
    }

    /**
     * Splice `![](src)` into the anchor block at the current selection.
     *
     * Inline images in muya are plain markdown text (`![](src)`) on a content
     * block; rendering turns the token into an image. We replace any
     * collapsed/expanded range and place the cursor after it. The src is
     * escaped the same way as {@link Format.replaceImage} so spaces and `#`
     * survive in the path.
     */
    private insertImageText(anchorBlock: Content, src: string): void {
        const cursor = anchorBlock.getCursor();
        if (!cursor)
            return;

        const { start, end } = cursor;
        const { text: content } = anchorBlock;
        const escapedSrc = src
            .replace(/ /g, encodeURI(' '))
            .replace(/#/g, encodeURIComponent('#'));
        const imageText = `![](${escapedSrc})`;

        anchorBlock.text
            = content.substring(0, start.offset)
                + imageText
                + content.substring(end.offset);

        const offset = start.offset + imageText.length;
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
