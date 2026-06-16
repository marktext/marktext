import type Content from './block/base/content';
import type Parent from './block/base/parent';
import type { TBlockPath } from './block/types';
import type { Listener } from './event/types';
import type { ILocale } from './i18n/types';
import type { IIndexCursor } from './selection/offsetCursor';
import type { IHistorySelection, IPublicCursorInput } from './selection/types';
import type { ITocItem } from './state/getTOC';
import type { IBulletListState, IOrderListState, ITableState, ITaskListState, TState } from './state/types';
import type { IMuyaOptions, Nullable } from './types';
import Format from './block/base/format';
import { ScrollPage } from './block/scrollPage';
import emptyStates from './config/emptyStates';
import {
    CLASS_NAMES,
    DATA_URL_REG,
    MUYA_DEFAULT_OPTIONS,
    URL_REG,
} from './config/index';
import { Editor } from './editor/index';

import EventCenter from './event/index';
import I18n from './i18n/index';
import {
    injectSentinels,
    injectStateSentinels,
    locateSentinelOffsets,
    resolveSentinelCursor,
} from './selection/offsetCursor';
import { getTOC } from './state/getTOC';
import { isAnyListState, isAtxHeadingState } from './state/types';
import { insertFrontMatterAtStart, replaceBlockByLabel } from './ui/paragraphQuickInsertMenu/config';
import { Ui } from './ui/ui';
import { deepClone } from './utils';
import './assets/styles/blockSyntax.css';
import './assets/styles/index.css';
import './assets/styles/inlineSyntax.css';
import './assets/styles/prismjs/light.theme.css';

// UI plugins (e.g. InlineFormatToolbar, EmojiSelector) follow a common
// shape: a class with a static `pluginName` and a constructor that takes
// `(muya: Muya, options: object)`. `Muya.use` records the constructor + an
// arbitrary options object; `init()` instantiates each plugin.
export interface IMuyaPluginConstructor {
    pluginName: string;
    new(muya: Muya, options: Record<string, unknown>): unknown;
}

interface IPlugin {
    plugin: IMuyaPluginConstructor;
    options: Record<string, unknown>;
}

// A selection reduced to document paths + offsets, with block references
// dropped so it survives a wholesale tree rebuild (paths are re-resolved
// against the fresh tree). Used to keep the caret/selection put across a
// loose/tight list toggle.
interface ISelectionSnapshot {
    anchor: number;
    focus: number;
    anchorPath: (string | number)[];
    focusPath: (string | number)[];
}

// Maps the paragraph-menu labels the desktop sends through `updateParagraph`
// to muya's `replaceBlockByLabel` vocabulary.
const PARAGRAPH_LABEL_MAP: Record<string, string> = {
    'paragraph': 'paragraph',
    'hr': 'thematic-break',
    'front-matter': 'frontmatter',
    'table': 'table',
    'mathblock': 'math-block',
    'html': 'html-block',
    'pre': 'code-block',
    'blockquote': 'block-quote',
    'heading 1': 'atx-heading 1',
    'heading 2': 'atx-heading 2',
    'heading 3': 'atx-heading 3',
    'heading 4': 'atx-heading 4',
    'heading 5': 'atx-heading 5',
    'heading 6': 'atx-heading 6',
    'ul-bullet': 'bullet-list',
    'ol-order': 'order-list',
    // The desktop command palette emits `ol-bullet` for the ordered-list
    // command while the menu emits `ol-order`; accept both.
    'ol-bullet': 'order-list',
    'ul-task': 'task-list',
    'mermaid': 'diagram mermaid',
    'plantuml': 'diagram plantuml',
    'vega-lite': 'diagram vega-lite',
    'flowchart': 'diagram flowchart',
    'sequence': 'diagram sequence',
};

export class Muya {
    static plugins: IPlugin[] = [];

    static use(plugin: IMuyaPluginConstructor, options: Record<string, unknown> = {}) {
        this.plugins.push({
            plugin,
            options,
        });
    }

    public readonly version = typeof window.MUYA_VERSION === 'undefined' ? 'dev' : window.MUYA_VERSION;
    public options: IMuyaOptions = MUYA_DEFAULT_OPTIONS;
    public eventCenter: EventCenter;
    public domNode: HTMLElement;
    public editor: Editor;
    public ui: Ui;
    public i18n: I18n;

    private _uiPlugins: Record<string, unknown> = {};

    constructor(element: HTMLElement, options?: Partial<IMuyaOptions>) {
        this.options = Object.assign({}, MUYA_DEFAULT_OPTIONS, options ?? {});
        this.eventCenter = new EventCenter();
        this.domNode = getContainer(element, this.options);
        // this.domNode[BLOCK_DOM_PROPERTY] = this;
        this.editor = new Editor(this);
        this.ui = new Ui(this);
        this.i18n = new I18n(this, this.options.locale);
        this._bindFocusBlurEvents();
    }

    // Expose `focus` / `blur` lifecycle events so external SDK consumers can
    // react to editor focus changes. Routed
    // through attachDOMEvent so cleanup is automatic via detachAllDomEvents
    // in destroy().
    private _bindFocusBlurEvents() {
        this.eventCenter.attachDOMEvent(this.domNode, 'focus', () => {
            this.eventCenter.emit('focus');
        });
        this.eventCenter.attachDOMEvent(this.domNode, 'blur', () => {
            this.eventCenter.emit('blur');
        });
    }

    init() {
        this.editor.init();

        // UI plugins
        if (Muya.plugins.length) {
            for (const { plugin: Plugin, options: opts } of Muya.plugins)
                this._uiPlugins[Plugin.pluginName] = new Plugin(this, opts);
        }
    }

    /**
     * Switch the editor's UI language at runtime. Swaps the i18n resources, then
     * re-renders the block tree so already-mounted blocks pick up the new
     * translation. The inline placeholder hints (quick-insert
     * "Type / to insert…", code-block language, math, front matter) are DOM
     * attributes baked once in each block's constructor; without the re-render
     * they would keep the old language until the block was next recreated.
     * History and the caret are preserved across the refresh (`_forceRender`).
     */
    locale(object: ILocale) {
        this.i18n.locale(object);
        if (this.editor.scrollPage)
            this._forceRender();
    }

    /**
     * [on] on custom event
     */
    on(event: string, listener: Listener) {
        this.eventCenter.on(event, listener);
    }

    /**
     * [off] off custom event
     */
    off(event: string, listener: Listener) {
        this.eventCenter.off(event, listener);
    }

    /**
     * [once] subscribe event and listen once
     */
    once(event: string, listener: Listener) {
        this.eventCenter.once(event, listener);
    }

    getState() {
        return this.editor.jsonState.getState();
    }

    getMarkdown() {
        return this.editor.jsonState.getMarkdown();
    }

    /**
     * Return a flat table of contents for the current document.
     *
     * Only top-level atx / setext headings are surfaced; nested
     * headings inside blockquotes / list items are ignored. `content` is the
     * raw heading text (inline markdown not
     * parsed); `slug` is a stable per-block identifier; `githubSlug` is
     * the GitHub-style anchor derived from `content`.
     */
    getTOC(): ITocItem[] {
        return getTOC(this);
    }

    undo() {
        this.editor.history.undo();
    }

    redo() {
        this.editor.history.redo();
    }

    /**
     * Return a JSON-serializable snapshot of the undo/redo history.
     *
     * Used by the desktop shell to persist each tab's editing history across
     * tab switches: read it before deactivating a tab, store it, and hand it
     * back to `setHistory` when the tab is re-selected. The ot-json1 ops are
     * deep-cloned plain JSON; selections are reduced to their serializable
     * paths/offsets (live block references are dropped and re-resolved on
     * restore). Lossless round-trip: `setHistory(getHistory())` then `undo()`
     * reproduces the prior document state.
     */
    getHistory() {
        return this.editor.history.getHistory();
    }

    /**
     * Restore a history snapshot previously produced by `getHistory`.
     */
    setHistory(history: ReturnType<Muya['getHistory']>) {
        this.editor.history.setHistory(history);
    }

    /**
     * Clear the undo/redo history (e.g. after loading a fresh document).
     */
    clearHistory() {
        this.editor.history.clear();
    }

    /**
     * Search value in current document.
     * @param {string} value
     * @param {object} opts
     */
    search(value: string, opts = {}) {
        return this.editor.searchModule.search(value, opts);
    }

    /**
     * Find preview or next value, and highlight it.
     * @param {string} action : previous or next.
     */
    find(action: 'previous' | 'next') {
        return this.editor.searchModule.find(action);
    }

    replace(replaceValue: string, opt = { isSingle: true, isRegexp: false }) {
        return this.editor.searchModule.replace(replaceValue, opt);
    }

    setContent(content: TState[] | string, autoFocus = false) {
        this.editor.setContent(content, autoFocus);
    }

    /**
     * Replace the whole document with `content` (markdown or a state array) as a
     * SINGLE undo boundary — the first subsequent `undo()` reverts the entire
     * replacement in one step. Unlike `setContent`, the existing undo/redo
     * history is preserved and a new boundary is pushed on top of it.
     *
     * Used by the desktop shell when handing a tab back from source-code mode:
     * the bulk source-mode edit becomes one undo step. The change is recorded
     * as a `rebuild` history entry, so undo /
     * redo re-create the block tree wholesale (`ScrollPage.updateState`) rather
     * than walking it incrementally — making arbitrary block-type changes
     * (paragraph<->heading, list/table/code/frontmatter, multi-block reorder…)
     * safe to round-trip. No-op when `content` is identical to the current
     * document.
     *
     * `recordSelection` overrides the caret stored on the rebuild boundary (the
     * one the first `undo()` restores). Pass it when the live DOM selection no
     * longer points into the muya tree at call time — notably the source-mode
     * handoff, where focus has moved to CodeMirror, so the desktop shell hands
     * back the caret captured when the user switched INTO source mode. Omitted,
     * it falls back to the current live selection.
     *
     * @returns `true` if a boundary was recorded, `false` if nothing changed.
     */
    replaceContent(content: TState[] | string, recordSelection?: Nullable<IHistorySelection>): boolean {
        const { jsonState, history } = this.editor;
        const { op, prevState } = jsonState.buildReplaceOp(content);

        if (op.length === 0)
            return false;

        const selection = this.editor.selection.getSelection();
        const boundarySelection = recordSelection !== undefined ? recordSelection : selection;
        // Record the lossless inverse as a standalone rebuild boundary BEFORE
        // applying the forward op, so the recorded `prevState` matches the doc
        // the inverse must restore. The forward apply dispatches a json-change,
        // so suppress History's own recording of it to avoid a duplicate entry.
        history.recordRebuild(op, prevState, boundarySelection);
        history.suppressRecording(() => {
            this.editor.rebuildContents(op, selection, 'api');
        });

        return true;
    }

    /**
     * Update editor options at runtime: merges `options` into `muya.options`,
     * reflects the container-level ones
     * (spellcheck, quick-insert hint), and — when `forceRender` is set — fully
     * re-renders the document from its current state so render-affecting
     * options (superSubScript, footnote, disableHtml, frontmatterType,
     * codeBlockLineNumbers, GitLab compatibility, …) take effect. Unlike
     * `setContent`, the undo history is preserved; the cursor is restored by path.
     */
    setOptions(options: Partial<IMuyaOptions>, forceRender = false) {
        Object.assign(this.options, options);

        if ('spellcheckEnabled' in options)
            this.domNode.setAttribute('spellcheck', options.spellcheckEnabled ? 'true' : 'false');

        if ('hideQuickInsertHint' in options) {
            this.domNode.classList.toggle(
                CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT,
                !options.hideQuickInsertHint,
            );
        }

        if (!forceRender)
            return;

        this._forceRender();
    }

    /**
     * Rebuild the whole block tree from its current state, preserving the undo
     * history (only `setContent` clears it; `updateState` does not) and
     * restoring the caret by path. Re-running every block constructor re-applies
     * the i18n-driven DOM attributes (placeholder hints, etc.), so this also
     * serves as the locale refresh. Shared by `setOptions(..., forceRender)` and
     * `locale()`.
     */
    private _forceRender() {
        const selection = this.editor.selection.getSelection();
        this.editor.scrollPage?.updateState(this.getState());
        // Restore the caret on the rebuilt tree by resolving the block at the
        // saved path and setting the cursor on it directly. (Passing only a
        // path to setSelection does not work — Selection._setCursor needs a
        // concrete block's domNode; a bare queryBlock result is not a Node.)
        if (selection && selection.isSelectionInSameBlock) {
            const begin = Math.min(selection.anchor.offset, selection.focus.offset);
            const end = Math.max(selection.anchor.offset, selection.focus.offset);
            const cursorBlock = this.editor.scrollPage?.queryBlock(selection.anchor.path);
            if (cursorBlock && cursorBlock.isContent())
                cursorBlock.setCursor(begin, end, true);
        }
    }

    /** Update the editor font size / line height. */
    setFont({ fontSize, lineHeight }: { fontSize?: IMuyaOptions['fontSize']; lineHeight?: IMuyaOptions['lineHeight'] }) {
        if (typeof fontSize === 'number')
            this.options.fontSize = fontSize;
        if (typeof lineHeight === 'number')
            this.options.lineHeight = lineHeight;
    }

    /** Update the tab size used for indentation. */
    setTabSize(tabSize: IMuyaOptions['tabSize']) {
        this.options.tabSize = tabSize;
    }

    /** Update list indentation and re-render so it takes effect. */
    setListIndentation(listIndentation: IMuyaOptions['listIndentation']) {
        this.setOptions({ listIndentation }, true);
    }

    focus() {
        this.editor.focus();
    }

    /**
     * Toggle focus mode. When enabled,
     * every top-level block except the one holding the cursor is dimmed via the
     * `mu-focus-mode` class on the editor container; the dimming itself lives in
     * the stylesheet (`.mu-focus-mode .mu-container > * { opacity }`).
     */
    setFocusMode(focusMode: boolean) {
        if (focusMode)
            this.domNode.classList.add(CLASS_NAMES.MU_FOCUS_MODE);
        else
            this.domNode.classList.remove(CLASS_NAMES.MU_FOCUS_MODE);

        this.options.focusMode = focusMode;
    }

    selectAll() {
        this.editor.selection.selectAll();
    }

    /**
     * Toggle an inline format on the current selection.
     * @param type One of strong/em/u/del/inline_code/link/image/inline_math/
     * sub/sup/mark/clear (and html_tag aliases). No-op when the selection is
     * not inside a single formattable block.
     */
    format(type: string) {
        const { selection } = this.editor;
        const sel = selection.getSelection();
        if (!sel)
            return;

        const { anchor, focus, isSelectionInSameBlock } = sel;
        const anchorBlock = anchor.block;

        if (!isSelectionInSameBlock || !(anchorBlock instanceof Format))
            return;

        // Restore the selection before applying the format — the menu/IPC
        // round-trip can drop the live DOM selection.
        selection.setSelection(
            { offset: anchor.offset, block: anchorBlock, path: anchor.path },
            { offset: focus.offset, block: focus.block, path: focus.path },
        );

        anchorBlock.format(type);
    }

    /**
     * Replace the word at the current cursor with `replacement`, then place the
     * cursor after the replacement.
     *
     * The desktop spell checker calls this when the user picks a suggestion
     * from the misspelled-word
     * context menu (Chromium has already selected the whole word). Unsafe: the
     * call is a no-op unless the word at the cursor matches `word`.
     *
     * @param word The expected (misspelled) word at the cursor.
     * @param replacement The replacement word.
     * @returns True when the replacement was applied.
     */
    replaceCurrentWordInlineUnsafe(word: string, replacement: string): boolean {
        const block = this.editor.activeContentBlock;
        if (!block)
            return false;

        return block.replaceCurrentWordInlineUnsafe(word, replacement);
    }

    /**
     * Return the current selection, or null when the editor has no selection.
     */
    getSelection() {
        return this.editor.selection.getSelection();
    }

    /**
     * Whether the editor (or one of its descendants) currently holds focus.
     */
    hasFocus() {
        const { activeElement } = document;

        return this.domNode === activeElement || this.domNode.contains(activeElement);
    }

    /**
     * Blur the editor. Always hides every floating tool and blurs the
     * contenteditable node.
     * @param isRemoveAllRange Remove all native selection ranges.
     * @param unSelect Clear the selected inline image so its toolbar/resize
     * bar do not linger after the editor is blurred.
     */
    blur(isRemoveAllRange = false, unSelect = false) {
        if (isRemoveAllRange)
            document.getSelection()?.removeAllRanges();

        if (unSelect)
            this.editor.selection.clearImage();

        this.editor.activeContentBlock = null;
        this.ui.hideAllFloatTools();
        this.domNode.blur();
    }

    /**
     * Hide every floating tool/menu (toolbars, pickers, front button, …).
     */
    hideAllFloatTools() {
        this.ui.hideAllFloatTools();
    }

    /**
     * Flush every cached inline image and force them to reload.
     *
     * The renderer memoises loaded images, so an image whose file changed on
     * disk would otherwise keep showing the stale bitmap. Desktop calls this
     * after a watched image file changes or on the `mt::invalidate-image-cache`
     * IPC; it clears the image caches and re-renders all content blocks so the
     * images load afresh.
     */
    invalidateImageCache() {
        this.editor.inlineRenderer.invalidateImageCache();
    }

    /**
     * Copy the current document as Markdown to the clipboard.
     */
    copyAsMarkdown() {
        this.editor.clipboard.copyAsMarkdown();
    }

    /**
     * Copy the current selection as rendered HTML to the clipboard.
     */
    copyAsHtml() {
        this.editor.clipboard.copyAsHtml();
    }

    /**
     * Copy the current selection as rich text to the clipboard: the rendered
     * HTML goes in the `text/html` slot so a rich-text target (Word, email, a
     * contenteditable) renders formatting, and the markdown source goes in the
     * `text/plain` slot. Unlike {@link copyAsHtml}, which blanks `text/html`
     * and drops the markup into `text/plain` as literal source.
     */
    copyAsRich() {
        this.editor.clipboard.copyAsRich();
    }

    /**
     * Paste the clipboard content as plain text at the current cursor.
     */
    pasteAsPlainText(): Promise<void> {
        return this.editor.clipboard.pasteAsPlainText();
    }

    /**
     * The outer-most block at the current cursor — the target for block-level
     * operations. Uses the persisted active content block (which survives the
     * menu/IPC round-trip), falling back to the selection anchor.
     */
    private _outmostBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;

        return content?.outMostBlock ?? null;
    }

    /**
     * The immediate block-level parent of the active content leaf — the
     * paragraph/heading block that directly wraps the cursor. Used by the
     * context-menu "Insert Paragraph Before/After" path: a new paragraph lands
     * as an inner sibling inside a list item / blockquote rather than jumping out to
     * the outermost container. Uses the persisted active content block (which
     * survives the menu/IPC round-trip), falling back to the selection anchor.
     */
    private _immediateBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;

        return content?.parent ?? null;
    }

    /**
     * Duplicate the block at the current cursor, placing the cursor in the
     * copy. No-op when there is no current block.
     */
    duplicate() {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        const state = deepClone(block.getState());
        const dupBlock = ScrollPage.loadBlock(state.name).create(this, state);
        block.parent!.insertAfter(dupBlock, block);
        dupBlock.lastContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Insert an empty paragraph relative to the block at the current cursor.
     * @param location Insert `before` or `after` the current block (default `after`).
     * @param text Initial text of the new paragraph.
     * @param outMost When `true`, anchor the new paragraph to the OUTERMOST
     *   container (the legacy "Create Paragraph Below" behaviour). When `false`
     *   (default), anchor to the IMMEDIATE block at the cursor so the paragraph
     *   stays as an inner sibling inside a list item / blockquote — the legacy
     *   context-menu "Insert Paragraph Before/After" behaviour.
     */
    insertParagraph(location: 'before' | 'after' = 'after', text = '', outMost = false) {
        const block = outMost
            ? this._outmostBlockAtCursor()
            : this._immediateBlockAtCursor();
        if (!block)
            return;

        const state = deepClone(emptyStates.paragraph);
        state.text = text;
        const newBlock = ScrollPage.loadBlock('paragraph').create(this, state);
        if (location === 'before')
            block.parent!.insertBefore(newBlock, block);
        else
            block.parent!.insertAfter(newBlock, block);

        newBlock.lastContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Delete the block at the current cursor, moving the cursor to an adjacent
     * block, or to a fresh empty paragraph when it was the only block.
     */
    deleteParagraph() {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        let cursorBlock: Content | null = null;
        if (block.prev) {
            cursorBlock = block.prev.lastContentInDescendant();
        }
        else if (block.next) {
            cursorBlock = block.next.firstContentInDescendant();
        }
        else {
            const newBlock = ScrollPage.loadBlock('paragraph').create(
                this,
                deepClone(emptyStates.paragraph),
            );
            block.parent!.insertAfter(newBlock, block);
            cursorBlock = newBlock.lastContentInDescendant();
        }

        block.remove();
        cursorBlock?.setCursor(0, 0, true);
    }

    /**
     * Insert a GFM table at the current cursor, replacing the block the cursor
     * is in. The table has `rows`
     * rows × `columns` columns with the first row as the header; every cell is
     * empty with `align: 'none'`. The cursor lands in the first cell. No-op when
     * there is no current block. `rows`/`columns` are coerced to integers and
     * clamped to a valid GFM shape (`rows >= 2`, `columns >= 1`) so invalid
     * input (e.g. `rows: 0`, non-finite, or fractional values) still yields a
     * usable table instead of an invalid state.
     */
    createTable({ rows, columns }: { rows: number; columns: number }) {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        // Coerce and clamp to a valid GFM table shape. A GFM table needs a
        // header row plus at least one body row (rows >= 2) and at least one
        // column (columns >= 1). Garbage input (NaN/Infinity/floats/negatives)
        // is normalised rather than producing an invalid state — `rows = 0`
        // would otherwise build a table with no rows and crash `columnCount`
        // (which reads `firstChild.firstChild`).
        const safeRows = Math.max(2, Number.isFinite(rows) ? Math.floor(rows) : 0);
        const safeColumns = Math.max(1, Number.isFinite(columns) ? Math.floor(columns) : 0);

        const makeRow = (): ITableState['children'][number] => ({
            name: 'table.row',
            children: Array.from({ length: safeColumns }, () => ({
                name: 'table.cell' as const,
                meta: { align: 'none' },
                text: '',
            })),
        });

        const state: ITableState = {
            name: 'table',
            children: Array.from({ length: safeRows }, makeRow),
        };

        const newTable = ScrollPage.loadBlock('table').create(this, state);
        block.replaceWith(newTable);
        newTable.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Insert an inline image at the current cursor in the active formattable
     * block. The `![alt](src)` markdown is
     * written through the `Format` block's text setter so it dispatches a JSON
     * op (state stays in sync) rather than mutating the DOM directly. No-op when
     * there is no active formattable (`Format`) block — e.g. inside a code block
     * or with no cursor.
     */
    insertImage({ src = '', alt = '' }: { src?: string; alt?: string }) {
        const block = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;
        if (!(block instanceof Format))
            return;

        const cursor = block.getCursor();
        if (cursor == null)
            return;

        // Derive a sensible alt from the file name when none is provided.
        if (!alt) {
            const match = /[/\\]?([^./\\]+)\.[a-z]+$/i.exec(src);
            alt = match?.[1] ?? '';
        }

        // Only percent-encode plain paths; leave full URLs / well-formed data
        // URLs as-is. `DATA_URL_REG` requires the full `data:image/<type>...,<payload>`
        // shape (the same regex `utils/image.ts` `getImageSrc` uses), so a bare
        // `data:image/` prefix is not embedded verbatim and instead falls through
        // to the plain-path branch.
        let imgUrl: string;
        if (URL_REG.test(src))
            imgUrl = encodeURI(src);
        else if (DATA_URL_REG.test(src))
            imgUrl = src;
        else
            imgUrl = src.replace(/ /g, encodeURI(' ')).replace(/#/g, encodeURIComponent('#'));

        const { start, end } = cursor;
        const { text } = block;
        // When there is a selection, use it as the alt text.
        const imageAlt = start.offset !== end.offset ? text.substring(start.offset, end.offset) : alt;
        const imageText = `![${imageAlt}](${imgUrl})`;

        // The `text` setter diffs against the old value and dispatches a JSON op.
        block.text = text.substring(0, start.offset) + imageText + text.substring(end.offset);
        // Re-render and place the caret on the alt text (offset of `![`).
        block.setCursor(start.offset + 2, start.offset + 2 + imageAlt.length, true);
    }

    /**
     * Set the cursor programmatically. The desktop passes a cursor like
     * `{ anchor, focus, anchorPath, focusPath }` (and may use `{ start, end }`
     * / `block` / `path`). Resolves the target block(s) by path on the live tree
     * and restores the selection the same way `Editor.updateContents` does —
     * `block.setCursor` for the same-block case, `selection.setSelection` with
     * resolved block instances for the cross-block case. Passing bare paths to
     * `setSelection` does not work (it needs a block's `domNode`), so we always
     * resolve and pass the block instance. No-op when the target can't be
     * resolved.
     */
    setCursor(cursor: IPublicCursorInput) {
        const { scrollPage } = this.editor;
        if (!scrollPage)
            return;

        const { anchor, focus, anchorPath, focusPath }
            = this._normalizeCursorEndpoints(cursor);

        if (!anchor || !focus)
            return;

        const { anchorBlock, focusBlock } = this._resolveCursorBlocks(
            cursor,
            scrollPage,
            anchorPath,
            focusPath,
        );

        if (anchorBlock == null || !anchorBlock.isContent())
            return;

        if (anchorBlock === focusBlock || focusBlock == null) {
            const begin = Math.min(anchor.offset, focus.offset);
            const last = Math.max(anchor.offset, focus.offset);
            anchorBlock.setCursor(begin, last, true);
            return;
        }

        if (!focusBlock.isContent())
            return;

        this.editor.selection.setSelection(
            { offset: anchor.offset, block: anchorBlock, path: anchorBlock.path },
            { offset: focus.offset, block: focusBlock, path: focusBlock.path },
        );
    }

    // Accept both the `{ anchor, focus, anchorPath, focusPath }` and the
    // `{ start, end, path }`/`block` shapes of IPublicCursorInput.
    private _normalizeCursorEndpoints(cursor: IPublicCursorInput) {
        const anchor = cursor.anchor ?? cursor.start ?? null;
        const focus = cursor.focus ?? cursor.end ?? anchor;
        const anchorPath = cursor.anchorPath ?? cursor.path;
        const focusPath = cursor.focusPath ?? cursor.path ?? anchorPath;

        return { anchor, focus, anchorPath, focusPath };
    }

    private _resolveCursorBlocks(
        cursor: IPublicCursorInput,
        scrollPage: ScrollPage,
        anchorPath: TBlockPath | undefined,
        focusPath: TBlockPath | undefined,
    ) {
        // queryBlock mutates its path argument (path.shift()) — pass copies.
        const anchorBlock
            = cursor.anchorBlock
                ?? cursor.block
                ?? (anchorPath ? scrollPage.queryBlock([...anchorPath]) : null);
        const focusBlock
            = cursor.focusBlock
                ?? cursor.block
                ?? (focusPath ? scrollPage.queryBlock([...focusPath]) : null);

        return { anchorBlock, focusBlock };
    }

    /**
     * Restore the WYSIWYG caret from a source-mode (CodeMirror) `{ line, ch }`
     * index cursor. The block tree has no source-line mapping, so the offsets
     * are resolved as follows: inject sentinel
     * strings into the current markdown at the line/ch positions, rebuild the
     * tree (sentinels embed as literal text), find which content blocks they
     * landed in, then rebuild the clean document and set the cursor by the
     * resolved block paths + offsets. The sentinel-bearing tree is transient —
     * both `setContent` calls run synchronously within this task, so no
     * intermediate paint happens.
     *
     * `Editor.setContent` clears the undo history, so this method snapshots the
     * history before its internal rebuild and restores it afterwards — the undo
     * stack is preserved, leaving only the caret changed. No-op (returns
     * `false`) when the cursor is stale / unresolvable, letting the caller fall
     * back to its default.
     */
    setCursorByOffset(indexCursor: IIndexCursor): boolean {
        const { scrollPage } = this.editor;
        if (!scrollPage)
            return false;

        const cleanMarkdown = this.getMarkdown();
        const sentinelMarkdown = injectSentinels(cleanMarkdown, indexCursor);
        if (sentinelMarkdown == null)
            return false;

        // Preserve the undo history across the internal setContent rebuild
        // (setContent clears it) so this stays a caret-only operation.
        const savedHistory = this.getHistory();

        this.editor.setContent(sentinelMarkdown);
        const cursor = resolveSentinelCursor(this.editor.scrollPage!);
        this.editor.setContent(cleanMarkdown);
        this.setHistory(savedHistory);

        if (!cursor)
            return false;

        this.setCursor(cursor);

        return true;
    }

    /**
     * Read the current WYSIWYG caret as a source-mode (CodeMirror) `{ line, ch }`
     * index cursor — the INVERSE of `setCursorByOffset`. The desktop emits this
     * on every change so toggling WYSIWYG -> source
     * opens CodeMirror at the same caret.
     *
     * The block tree has no source-line mapping, so the offset is recovered the
     * same way `setCursorByOffset` resolves the reverse: clone the current
     * state, splice sentinel strings into the selected block's text at the
     * anchor/focus offsets, serialize that clone to markdown (identical to what
     * source mode shows), then read each sentinel's line/column back out. The
     * live document and undo history are untouched — only a throwaway clone is
     * mutated. Returns `null` when there is no selection or the caret can't be
     * located (the caller then falls back to its default cursor placement).
     */
    getCursorOffset(): IIndexCursor | null {
        const selection = this.editor.selection.getSelection();
        if (!selection)
            return null;

        const sentinelState = injectStateSentinels(
            this.editor.jsonState.getState(),
            selection,
        );
        if (!sentinelState)
            return null;

        const sentinelMarkdown
            = this.editor.jsonState.getMarkdownFromState(sentinelState);

        return locateSentinelOffsets(sentinelMarkdown);
    }

    /**
     * Convert the block at the cursor to another type. `type` uses the
     * paragraph-menu
     * vocabulary: `paragraph`, `heading 1`–`heading 6`, `upgrade heading`,
     * `degrade heading`, `blockquote`, `pre`, `mathblock`, `html`, `hr`,
     * `table`, `front-matter`, `ul-bullet`/`ol-order`/`ul-task`,
     * `loose-list-item`, `reset-to-paragraph`, and the diagram types.
     */
    updateParagraph(type: string) {
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        if (type === 'upgrade heading' || type === 'degrade heading') {
            this._changeHeadingLevel(block, type);
            return;
        }

        if (type === 'loose-list-item') {
            this._toggleLooseList(block);
            return;
        }

        // `reset-to-paragraph` returns the current block to plain paragraph
        // form; structured containers (lists/blockquote) unwrap to preserve
        // every child, tables are left untouched.
        if (type === 'reset-to-paragraph') {
            this.resetToParagraph(block);
            return;
        }

        const label = PARAGRAPH_LABEL_MAP[type];
        if (!label)
            return;

        // Front matter is only valid as the very first block of a document, so
        // it is never an in-place replacement of the cursor block: idempotent
        // no-op if the document already starts with front matter, otherwise
        // prepend one at the top.
        if (label === 'frontmatter') {
            insertFrontMatterAtStart(this);
            return;
        }

        // The plain `paragraph` menu item only converts the *leaf* block that
        // directly wraps the cursor (heading, hr, …) back to a paragraph; it
        // never touches the enclosing container. Operating on the leaf (not the
        // outermost container) means a heading inside a list item still converts
        // while the list stays intact, and avoids the data loss where routing
        // `paragraph` to the *whole* list/blockquote collapsed every item/line
        // into a single paragraph built from the first content's text.
        // `reset-to-paragraph` remains the explicit "unwrap the container"
        // command (handled above).
        if (label === 'paragraph')
            return this._convertLeafToParagraph();

        if (label.endsWith('-list') && isAnyListState(block.getState())) {
            // Selecting the active list type toggles the list off (unwrap each
            // item back into paragraphs); a different type converts in place,
            // preserving every item.
            if (block.blockName === label)
                this._unwrapToParagraphs(block);
            else
                this._convertListType(block, label);

            return;
        }

        // hr/table only replace an empty block so user content is never
        // silently dropped.
        if (
            (label === 'thematic-break' || label === 'table')
            && this._blockLeadingText(block).trim() !== ''
        ) {
            return;
        }

        replaceBlockByLabel({
            block,
            muya: this,
            label,
            text: this._blockLeadingText(block),
        });
    }

    /**
     * Return a block to plain paragraph form: lists and blockquotes unwrap to
     * preserve every child, tables are left untouched, and everything else is
     * replaced by a paragraph carrying its leading text. Public so the
     * paragraph front menu can reset the block it targets (not just the cursor
     * block).
     */
    resetToParagraph(block: Parent) {
        if (block.blockName === 'table')
            return;

        if (isAnyListState(block.getState()) || block.blockName === 'block-quote') {
            this._unwrapToParagraphs(block);
            return;
        }

        replaceBlockByLabel({
            block,
            muya: this,
            label: 'paragraph',
            text: this._blockLeadingText(block),
        });
    }

    /**
     * Convert the *leaf* block that directly wraps the cursor (the immediate
     * parent of the active content) to a plain paragraph. No-op when that leaf
     * is already a paragraph. Because it targets the leaf rather
     * than the outermost container, a heading inside a list item / blockquote
     * converts to a paragraph while leaving the surrounding list/quote intact.
     */
    private _convertLeafToParagraph() {
        const leaf = this._immediateBlockAtCursor();
        if (!leaf || leaf.blockName === 'paragraph')
            return;

        replaceBlockByLabel({
            block: leaf,
            muya: this,
            label: 'paragraph',
            text: this._blockLeadingText(leaf),
        });
    }

    /**
     * Unwrap a structured container (list or blockquote) into the top-level
     * blocks it contains, preserving every item.
     */
    private _unwrapToParagraphs(block: Parent) {
        const state = block.getState();
        let inner: TState[] = [];
        if (isAnyListState(state))
            inner = state.children.flatMap(li => deepClone(li.children));
        else if (state.name === 'block-quote')
            inner = deepClone(state.children);

        if (!inner.length)
            return;

        const parent = block.parent!;
        let ref: Parent = block;
        let firstNew: Parent | null = null;
        for (const childState of inner) {
            const newBlock = ScrollPage.loadBlock(childState.name).create(this, childState);
            parent.insertAfter(newBlock, ref);
            ref = newBlock;
            firstNew ??= newBlock;
        }

        block.remove();
        firstNew?.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    /** Leading text of a block, with the atx hash run stripped for headings. */
    private _blockLeadingText(block: Parent): string {
        const text = block.firstContentInDescendant()?.text ?? '';

        return block.blockName === 'atx-heading'
            ? text.replace(/^ {0,3}#{1,6}(?:\s+|$)/, '')
            : text;
    }

    /** Cycle the heading level (marktext upgrade/degrade semantics). */
    private _changeHeadingLevel(block: Parent, type: 'upgrade heading' | 'degrade heading') {
        const state = block.getState();
        const level = isAtxHeadingState(state) ? state.meta.level : 0;
        let newLevel = level;

        if (type === 'upgrade heading' && level !== 1)
            newLevel = level === 0 ? 6 : level - 1;
        else if (type === 'degrade heading' && level !== 0)
            newLevel = level === 6 ? 0 : level + 1;

        if (newLevel === level)
            return;

        replaceBlockByLabel({
            block,
            muya: this,
            label: newLevel === 0 ? 'paragraph' : `atx-heading ${newLevel}`,
            text: this._blockLeadingText(block),
        });
    }

    /** Toggle loose/tight on the list at the cursor. */
    private _toggleLooseList(block: Parent) {
        const state = block.getState();
        if (!isAnyListState(state))
            return;

        // Toggling only flips meta.loose, so the rebuilt list keeps the same
        // structure and document position. Snapshot the selection as paths +
        // offsets so a caret OR a multi-item range can be restored afterwards
        // instead of collapsing to the first item.
        const snapshot = this._snapshotSelection();

        const newState = deepClone(state);
        newState.meta.loose = !newState.meta.loose;
        const newBlock = ScrollPage.loadBlock(newState.name).create(this, newState);
        block.replaceWith(newBlock);

        if (!this._restoreSelection(snapshot))
            newBlock.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Capture the current selection as document paths + offsets. The live DOM
     * selection is the source of truth (it carries a click-placed caret), with
     * the cached selection — committed on mouse-up and surviving the menu/IPC
     * round-trip — as the fallback. Block references are intentionally dropped:
     * they go stale when the list is rebuilt, so the paths are re-resolved on
     * restore.
     */
    private _snapshotSelection(): ISelectionSnapshot | null {
        const sel = this.editor.selection;
        const live = sel.getSelection();
        const anchor = live?.anchor ?? sel.anchor;
        const focus = live?.focus ?? sel.focus;
        const anchorPath = live?.anchor.path ?? sel.anchorPath;
        const focusPath = live?.focus.path ?? sel.focusPath;
        if (!anchor || !focus || !anchorPath?.length || !focusPath?.length)
            return null;

        return {
            anchor: anchor.offset,
            focus: focus.offset,
            anchorPath: [...anchorPath],
            focusPath: [...focusPath],
        };
    }

    /**
     * Re-resolve a snapshot's paths against the live tree and re-apply it via
     * the selection API. Returns false when either path no longer resolves to a
     * content block so the caller can fall back.
     */
    private _restoreSelection(snapshot: ISelectionSnapshot | null): boolean {
        if (!snapshot)
            return false;

        const { scrollPage } = this.editor;
        // `queryBlock` consumes its path array in place, so resolve against copies.
        const anchorBlock = scrollPage?.queryBlock([...snapshot.anchorPath]);
        const focusBlock = scrollPage?.queryBlock([...snapshot.focusPath]);
        if (!anchorBlock || !focusBlock)
            return false;
        if (!anchorBlock.isContent() || !focusBlock.isContent())
            return false;

        this.editor.activeContentBlock = focusBlock;
        this.editor.selection.setSelection(
            { offset: snapshot.anchor, block: anchorBlock, path: [...snapshot.anchorPath] },
            { offset: snapshot.focus, block: focusBlock, path: [...snapshot.focusPath] },
        );

        return true;
    }

    /** Convert an existing list to another list type, preserving items. */
    private _convertListType(block: Parent, label: string) {
        const state = block.getState();
        if (!isAnyListState(state) || block.blockName === label)
            return;

        const { bulletListMarker, orderListDelimiter } = this.options;
        const loose = !!state.meta.loose;
        const childContents: TState[][] = state.children.map(li => deepClone(li.children));

        let newState: IBulletListState | IOrderListState | ITaskListState;
        if (label === 'task-list') {
            newState = {
                name: 'task-list',
                meta: { marker: bulletListMarker, loose },
                children: childContents.map(children => ({
                    name: 'task-list-item',
                    meta: { checked: false },
                    children,
                })),
            };
        }
        else if (label === 'order-list') {
            newState = {
                name: 'order-list',
                meta: { delimiter: orderListDelimiter, loose, start: 1 },
                children: childContents.map(children => ({ name: 'list-item', children })),
            };
        }
        else {
            newState = {
                name: 'bullet-list',
                meta: { marker: bulletListMarker, loose },
                children: childContents.map(children => ({ name: 'list-item', children })),
            };
        }

        const newBlock = ScrollPage.loadBlock(label).create(this, newState);
        block.replaceWith(newBlock);
        newBlock.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    destroy() {
        this.eventCenter.detachAllDomEvents();
        this.eventCenter.unsubscribeAll();
        // this.domNode[BLOCK_DOM_PROPERTY] = null;
        if (this.domNode.remove)
            this.domNode.remove();

        // Hide all float tools.
        if (this.ui)
            this.ui.hideAllFloatTools();
    }
}

/**
 * [ensureContainerDiv ensure container element is div]
 */
function getContainer(originContainer: HTMLElement, options: IMuyaOptions) {
    const { spellcheckEnabled, hideQuickInsertHint, focusMode } = options;
    const newContainer = document.createElement('div');
    const attrs = originContainer.attributes;
    // Copy attrs from origin container to new container
    Array.from(attrs).forEach((attr: { name: string; value: string }) => {
        newContainer.setAttribute(attr.name, attr.value);
    });

    if (!hideQuickInsertHint)
        newContainer.classList.add(CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT);

    // Apply focus mode at construction when initially enabled; `setFocusMode`
    // toggles it thereafter.
    if (focusMode)
        newContainer.classList.add(CLASS_NAMES.MU_FOCUS_MODE);

    newContainer.classList.add(CLASS_NAMES.MU_EDITOR);

    newContainer.setAttribute('contenteditable', 'true');
    newContainer.setAttribute('autocorrect', 'false');
    newContainer.setAttribute('autocomplete', 'off');
    newContainer.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
    originContainer.replaceWith(newContainer);

    return newContainer;
}
