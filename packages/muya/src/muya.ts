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
import { canTurnInto, insertBlockBelowByLabel, insertFrontMatterAtStart, replaceBlockByLabel } from './block/blockTransforms';
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
import { isAnyListState, isAtxHeadingState, isCodeBlockState } from './state/types';
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

// The outmost-block labels that wrap a cross-block selection into a list.
const CROSS_BLOCK_LIST_LABELS = new Set(['bullet-list', 'order-list', 'task-list']);

// Paragraph-menu labels whose block toggles back to a paragraph when the cursor
// is already inside one (the menu item is checked) — clicking unwraps/removes it.
const TOGGLEABLE_BLOCK_LABELS = new Set([
    'bullet-list',
    'order-list',
    'task-list',
    'block-quote',
    'code-block',
    'thematic-break',
]);

// Options consumed by the markdown→state lexer (markdownToState / lexBlock).
// Changing any of these re-classifies block structure (e.g. ```math ⇄ code
// block under GitLab compatibility, front matter, footnote definitions), which
// a render-only rebuild from the already-parsed state cannot reflect — the
// document must be re-parsed from markdown. See setOptions below.
const PARSE_AFFECTING_OPTIONS = new Set<keyof IMuyaOptions>([
    'isGitlabCompatibilityEnabled',
    'math',
    'footnote',
    'frontMatter',
    'trimUnnecessaryCodeBlockEmptyLines',
]);

function endpointPair(
    anchor: Nullable<Parent>,
    focus: Nullable<Parent>,
): { anchor: Parent; focus: Parent } | null {
    return anchor && focus ? { anchor, focus } : null;
}

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

    getTOC(): ITocItem[] {
        return this.editor.jsonState.getTOC();
    }

    undo() {
        this.editor.history.undo();
    }

    redo() {
        this.editor.history.redo();
    }

    getHistory() {
        return this.editor.history.getHistory();
    }

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

    setOptions(options: Partial<IMuyaOptions>, forceRender = false) {
        Object.assign(this.options, options);

        if ('spellcheckEnabled' in options)
            this.domNode.setAttribute('spellcheck', options.spellcheckEnabled ? 'true' : 'false');

        if ('spellcheckHideMarks' in options) {
            this.domNode.classList.toggle(
                CLASS_NAMES.MU_HIDE_SPELLING_MARKS,
                !!options.spellcheckHideMarks,
            );
        }

        if ('hideQuickInsertHint' in options) {
            this.domNode.classList.toggle(
                CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT,
                !options.hideQuickInsertHint,
            );
        }

        if (!forceRender)
            return;

        if (Object.keys(options).some(key => PARSE_AFFECTING_OPTIONS.has(key as keyof IMuyaOptions))) {
            const { jsonState } = this.editor;
            jsonState.setContent(jsonState.markdownToState(this.getMarkdown()));
        }

        this._forceRender();
    }

    private _forceRender() {
        const selection = this.editor.selection.getSelection();
        this.editor.scrollPage?.updateState(this.getState());

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

    format(type: string) {
        const { selection } = this.editor;

        // Cross-block selection: apply to each formattable leaf in range. The
        // live DOM selection collapses across blocks, so detect via the cached
        // endpoints (the same ones the menu/IPC round-trip relies on).
        if (!this._selectionInSameBlock()) {
            this._formatAcrossBlocks(type);
            return;
        }

        const sel = selection.getSelection();
        if (!sel)
            return;

        const { anchor, focus, isSelectionInSameBlock } = sel;
        const anchorBlock = anchor.block;

        if (!isSelectionInSameBlock || !(anchorBlock instanceof Format))
            return;

        // A heading's text includes its leading `# ` marker; never format the
        // marker itself, only the heading content. Clamp the start past it.
        const markerLen = this._headingMarkerLen(anchorBlock);
        let lo = Math.min(anchor.offset, focus.offset);
        const hi = Math.max(anchor.offset, focus.offset);
        if (markerLen > 0) {
            lo = Math.max(lo, markerLen);
            if (hi <= markerLen)
                return; // the selection lies entirely within the marker
        }

        // Restore the selection before applying the format — the menu/IPC
        // round-trip can drop the live DOM selection.
        selection.setSelection(
            { offset: lo, block: anchorBlock, path: anchor.path },
            { offset: hi, block: anchorBlock, path: focus.path },
        );

        anchorBlock.format(type);
    }

    private _formatAcrossBlocks(type: string) {
        if (type === 'link' || type === 'image')
            return;

        const range = this._orderedSelectionRange();
        if (!range)
            return;

        const { first, last, firstOffset, lastOffset } = range;

        // Restore the span across the formatted leaves using each leaf's
        // post-format offsets (adding a marker shifts them), so the SAME text
        // stays selected in both endpoints rather than collapsing onto the
        // pre-format offsets.
        let anchorLeaf: Content | null = null;
        let focusLeaf: Content | null = null;
        let anchorOffset = 0;
        let focusOffset = 0;

        let leaf: Content | null = first;
        while (leaf) {
            const start = leaf === first ? firstOffset : 0;
            const end = leaf === last ? lastOffset : leaf.text.length;
            const adjusted = this._formatLeafInRange(type, leaf, start, end);
            if (adjusted) {
                if (!anchorLeaf) {
                    anchorLeaf = leaf;
                    anchorOffset = adjusted.start;
                }
                focusLeaf = leaf;
                focusOffset = adjusted.end;
            }
            if (leaf === last)
                break;
            leaf = leaf.nextContentInContext() ?? null;
        }

        if (anchorLeaf && focusLeaf) {
            this.editor.selection.setSelection(
                { offset: anchorOffset, block: anchorLeaf, path: anchorLeaf.path },
                { offset: focusOffset, block: focusLeaf, path: focusLeaf.path },
            );
        }
    }

    /** The selection's first/last content leaves and offsets, in document order. */
    private _orderedSelectionRange() {
        const { selection } = this.editor;
        const anchorLeaf = selection.anchorBlock;
        const focusLeaf = selection.focusBlock;
        if (!anchorLeaf || !focusLeaf)
            return null;

        const sp = this.editor.scrollPage!;
        const anchorOut = anchorLeaf.outMostBlock;
        const focusOut = focusLeaf.outMostBlock;
        const forward = anchorOut && focusOut ? sp.offset(anchorOut) <= sp.offset(focusOut) : true;

        return {
            first: forward ? anchorLeaf : focusLeaf,
            last: forward ? focusLeaf : anchorLeaf,
            firstOffset: (forward ? selection.anchor?.offset : selection.focus?.offset) ?? 0,
            lastOffset: (forward ? selection.focus?.offset : selection.anchor?.offset) ?? 0,
        };
    }

    /**
     * Apply `type` to one leaf over [start, end], skipping non-formattable
     * leaves and a heading's leading `# ` marker. Returns the leaf's selection
     * range AFTER formatting (offsets shift past inserted markers), or null when
     * the leaf was skipped.
     */
    private _formatLeafInRange(type: string, leaf: Content, start: number, end: number): { start: number; end: number } | null {
        if (!(leaf instanceof Format))
            return null;

        // Never format a heading's leading `# ` marker, only its content.
        const from = Math.max(start, this._headingMarkerLen(leaf));
        if (end <= from)
            return null;

        const { selection } = this.editor;
        selection.setSelection(
            { offset: from, block: leaf, path: leaf.path },
            { offset: end, block: leaf, path: leaf.path },
        );
        leaf.format(type);

        // leaf.format ends with setCursor(adjustedStart, adjustedEnd), which
        // updates the cached selection — read the adjusted range back from it.
        return {
            start: selection.anchor?.offset ?? from,
            end: selection.focus?.offset ?? end,
        };
    }

    /** Length of a heading content's leading `#{1,6}` + space marker, else 0. */
    private _headingMarkerLen(leaf: Content): number {
        if (leaf.parent?.blockName !== 'atx-heading')
            return 0;

        return /^ {0,3}#{1,6}(?:\s+|$)/.exec(leaf.text)?.[0].length ?? 0;
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
     * Insert an image at the current cursor from an explicit `src` (a saved file
     * path or `data:` URL), routing through the configured `imageAction` like a
     * clipboard image paste. Drives the desktop macOS screenshot flow, which can
     * no longer rely on the removed `document.execCommand('paste')`.
     */
    pasteImage(src: string): Promise<void> {
        return this.editor.clipboard.pasteImage(src);
    }

    private _outmostBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;

        return content?.outMostBlock ?? null;
    }

    private _immediateBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;

        return content?.parent ?? null;
    }

    /**
     * Cross-block paragraph-menu handling: a selection that spans several
     * outmost blocks wraps each block into one list item. Returns true when the
     * operation was handled so the single-block path is skipped. Quote/code and
     * other cross-block targets are gated by the menu layer and fall through.
     */
    private _handleCrossBlockParagraph(type: string): boolean {
        if (this._selectionInSameBlock())
            return false;

        const label = PARAGRAPH_LABEL_MAP[type];
        if (CROSS_BLOCK_LIST_LABELS.has(label)) {
            this._wrapSelectedBlocksInList(label as 'bullet-list' | 'order-list' | 'task-list');
            return true;
        }
        if (label === 'block-quote') {
            this._wrapSelectedBlocksInQuote();
            return true;
        }
        if (label === 'code-block') {
            this._wrapSelectedBlocksInCodeBlock();
            return true;
        }

        return false;
    }

    /**
     * The outmost-block endpoints of the current selection. Prefers the pair
     * that spans two different outmost blocks: the live DOM selection is the
     * truth in the browser, but the cached selection endpoints survive the
     * menu/IPC round-trip (and the headless test environment, where
     * `Selection.extend` collapses a cross-node range to one block).
     */
    private _selectionEndpoints(): { anchor: Parent; focus: Parent } | null {
        const sel = this.editor.selection.getSelection();
        const live = endpointPair(sel?.anchor.block?.outMostBlock, sel?.focus.block?.outMostBlock);
        const cached = endpointPair(
            this.editor.selection.anchorBlock?.outMostBlock,
            this.editor.selection.focusBlock?.outMostBlock,
        );

        if (live && live.anchor !== live.focus)
            return live;
        if (cached && cached.anchor !== cached.focus)
            return cached;

        return live ?? cached;
    }

    /** Whether the current selection stays within a single outmost block. */
    private _selectionInSameBlock(): boolean {
        const endpoints = this._selectionEndpoints();
        if (!endpoints)
            return true;

        return endpoints.anchor === endpoints.focus;
    }

    /**
     * The contiguous run of OUTMOST (scrollPage-child) blocks the current
     * selection spans, in document order. Mirrors clipboard's outmost walk.
     */
    private _selectedOutmostBlocks(): Parent[] {
        const endpoints = this._selectionEndpoints();
        if (!endpoints)
            return [];

        const a = endpoints.anchor;
        const f = endpoints.focus;

        if (a === f)
            return [a];

        const sp = this.editor.scrollPage!;
        const start = sp.offset(a) <= sp.offset(f) ? a : f;
        const end = start === a ? f : a;
        const blocks: Parent[] = [];
        let node: Parent | null = start;
        while (node) {
            blocks.push(node);
            if (node === end)
                break;
            node = node.next as Parent | null;
        }

        return blocks;
    }

    /**
     * Select the full span of a freshly-wrapped container (first content leaf to
     * last) so the selection keeps covering the wrapped content. Best-effort.
     */
    private _selectWrappedContent(container: Parent) {
        const head = container.firstContentInDescendant();
        const tail = container.lastContentInDescendant();
        if (!head || !tail)
            return;

        this.editor.activeContentBlock = tail;
        this.editor.selection.setSelection(
            { offset: 0, block: head, path: head.path },
            { offset: tail.text.length, block: tail, path: tail.path },
        );
    }

    /**
     * Replace the selected outmost blocks with a single container built by
     * `buildState`, then position the cursor/selection via `place`. Shared by the
     * cross-block list / block-quote / code-block wraps (ported from muyajs's
     * handleListMenu / handleQuoteMenu / handleCodeBlockMenu multi-block branches).
     */
    private _wrapSelectedBlocks(
        buildState: (blocks: Parent[]) => { name: string } & Record<string, unknown>,
        place: (container: Parent) => void,
    ) {
        const blocks = this._selectedOutmostBlocks();
        if (!blocks.length)
            return;

        const state = buildState(blocks);
        const container = ScrollPage.loadBlock(state.name).create(this, state as never);
        const parent = blocks[0].parent!;
        parent.insertBefore(container, blocks[0]);
        for (const b of blocks)
            b.remove();

        place(container);
    }

    /** Wrap the selected outmost blocks as items of a new list of `label`. */
    private _wrapSelectedBlocksInList(label: 'bullet-list' | 'order-list' | 'task-list') {
        const { bulletListMarker, orderListDelimiter, preferLooseListItem } = this.options;
        const itemName = label === 'task-list' ? 'task-list-item' : 'list-item';
        const meta: Record<string, unknown> = label === 'order-list'
            ? { loose: preferLooseListItem, delimiter: orderListDelimiter, start: 1 }
            : { loose: preferLooseListItem, marker: bulletListMarker };

        this._wrapSelectedBlocks(
            blocks => ({
                name: label,
                meta,
                children: blocks.map(b => label === 'task-list'
                    ? { name: itemName, meta: { checked: false }, children: [b.getState()] }
                    : { name: itemName, children: [b.getState()] }),
            }),
            container => this._selectWrappedContent(container),
        );
    }

    /** Wrap the selected outmost blocks into a single block-quote. */
    private _wrapSelectedBlocksInQuote() {
        this._wrapSelectedBlocks(
            blocks => ({ name: 'block-quote', children: blocks.map(b => b.getState()) }),
            container => this._selectWrappedContent(container),
        );
    }

    /** Join the selected outmost blocks' text into a single fenced code block. */
    private _wrapSelectedBlocksInCodeBlock() {
        this._wrapSelectedBlocks(
            blocks => ({
                name: 'code-block',
                meta: { type: 'fenced', lang: '' },
                text: this.editor.jsonState
                    .getMarkdownFromState(blocks.map(b => b.getState()))
                    .replace(/\n+$/, ''),
            }),
            container => container.firstContentInDescendant()?.setCursor(0, 0, true),
        );
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

    createTable({ rows, columns }: { rows: number; columns: number }, { replace = false }: { replace?: boolean } = {}) {
        const block = this._immediateBlockAtCursor();
        if (!block)
            return;

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

        // An empty block is disposable, so replace it in place; a block with
        // real content is kept and the table goes directly below it. The picker
        // passes `replace` to always consume its trigger block.
        if (replace || this._blockLeadingText(block).trim() === '')
            block.replaceWith(newTable);
        else
            block.parent!.insertAfter(newTable, block);

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

        if (this._handleCrossBlockParagraph(type))
            return;

        if (type === 'upgrade heading' || type === 'degrade heading') {
            this._withPreservedOffset(() => this._changeHeadingLevel(block, type));
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

        // Clicking an already-active type (its block is an ancestor of the
        // cursor, i.e. the menu item is checked) toggles it off: unwrap every
        // ancestor of that kind, or convert the matching leaf back to a paragraph.
        if (this._toggleIfActive(label))
            return;

        // A list kind clicked while inside a list of a DIFFERENT kind converts
        // the cursor's (innermost) list to that kind.
        if (label.endsWith('-list')) {
            const list = this._closestListAtCursor();
            if (list) {
                this._withPreservedOffset(() => this._convertListType(list, label));
                return;
            }
        }

        this._convertOrInsertBelow(label);
    }

    /**
     * If the cursor is inside a block matching `label` (the menu item is
     * checked), toggle it off and return true: unwrap EVERY ancestor of that
     * kind (so nested same-kind lists collapse in one click and the item ends up
     * un-checked), or convert a matching leaf (heading of that level / hr) back
     * to a paragraph. Returns false when nothing matches.
     */
    private _toggleIfActive(label: string): boolean {
        const cursorContent = () => this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;
        const content = cursorContent();
        if (!content)
            return false;

        // Headings match only when the cursor's heading is exactly that level.
        if (label.startsWith('atx-heading ')) {
            const heading = content.closestBlock('atx-heading') as Parent | null;
            if (!heading)
                return false;

            const state = heading.getState();
            const level = Number(label.slice('atx-heading '.length));
            if (!isAtxHeadingState(state) || state.meta.level !== level)
                return false;

            this._withPreservedOffset(() => this.resetToParagraph(heading));
            return true;
        }

        if (!TOGGLEABLE_BLOCK_LABELS.has(label) || !content.closestBlock(label))
            return false;

        this._withPreservedOffset(() => {
            for (let guard = 0; guard < 20; guard++) {
                const target = cursorContent()?.closestBlock(label) as Parent | null;
                if (!target)
                    break;
                this.resetToParagraph(target);
            }
        });

        return true;
    }

    /** The nearest list ancestor of the cursor, of any kind. */
    private _closestListAtCursor(): Parent | null {
        let node: Nullable<Parent> = (this.editor.activeContentBlock ?? this.editor.selection.anchorBlock)?.parent;
        while (node) {
            if (node.blockName === 'bullet-list' || node.blockName === 'order-list' || node.blockName === 'task-list')
                return node;
            node = node.parent;
        }

        return null;
    }

    /**
     * Run a conversion, then restore the prior selection (anchor AND focus, so a
     * range stays selected) on the active content block — every conversion ends
     * with the caret's content active (unwraps restore it themselves).
     */
    private _withPreservedOffset(fn: () => void) {
        const { selection } = this.editor;
        const anchorBlock = selection.anchorBlock;
        const focusBlock = selection.focusBlock;
        const anchorOffset = selection.anchor?.offset ?? 0;
        const focusOffset = selection.focus?.offset ?? anchorOffset;
        const anchorText = anchorBlock?.text;
        const focusText = focusBlock?.text;
        const multiBlock = !!anchorBlock && !!focusBlock && anchorBlock !== focusBlock;

        fn();

        const clampTo = (n: number, len: number) => Math.max(0, Math.min(n, len));

        // A selection spanning several blocks (e.g. across list items) — re-find
        // both endpoints by their text so the whole span survives an unwrap.
        if (multiBlock && anchorText != null && focusText != null) {
            const a = this._findContentByText(anchorText);
            const f = this._findContentByText(focusText);
            if (a && f) {
                this.editor.selection.setSelection(
                    { offset: clampTo(anchorOffset, a.text.length), block: a, path: a.path },
                    { offset: clampTo(focusOffset, f.text.length), block: f, path: f.path },
                );
                return;
            }
        }

        // Single block: the caret's content is the active block (in-place result
        // or unwrap-restored). The text can change in place (a heading's `# `
        // marker), so shift offsets by that front delta to track the same char.
        const target = this.editor.activeContentBlock;
        if (!target)
            return;

        const delta = anchorText != null && target.text !== anchorText
            ? target.text.length - anchorText.length
            : 0;
        const len = target.text.length;
        target.setCursor(clampTo(anchorOffset + delta, len), clampTo(focusOffset + delta, len), true);
    }

    /**
     * The first FORMATTABLE content leaf whose text equals `text`, in document
     * order. Restricting to Format leaves skips marker-only content (a thematic
     * break's `---`, code/math/html), so toggling one never lands the caret on
     * an unrelated block that happens to share that text.
     */
    private _findContentByText(text: string): Content | null {
        let leaf: Nullable<Content> = this.editor.scrollPage?.firstContentInDescendant();
        while (leaf) {
            if (leaf instanceof Format && leaf.text === text)
                return leaf;
            leaf = leaf.nextContentInContext();
        }

        return null;
    }

    /**
     * General same-block conversion: the front menu's turn-into set is the
     * single source of truth. Operate on the IMMEDIATE block so a heading inside
     * a list item converts while the list stays intact; a target that is not a
     * valid turn-into replaces an empty block in place, or is inserted as a new
     * block directly below a non-empty one (focus moves into it).
     */
    private _convertOrInsertBelow(label: string) {
        const immediate = this._immediateBlockAtCursor();
        if (!immediate)
            return;

        const leadingText = this._blockLeadingText(immediate);
        if (canTurnInto(immediate, label)) {
            this._withPreservedOffset(() => replaceBlockByLabel({ block: immediate, muya: this, label, text: leadingText }));
            return;
        }

        if (leadingText.trim() === '')
            replaceBlockByLabel({ block: immediate, muya: this, label, text: '' });
        else
            insertBlockBelowByLabel({ block: immediate, muya: this, label });
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

        replaceBlockByLabel({ block, muya: this, label: 'paragraph', text: this._paragraphTextFor(block) });
    }

    /**
     * The text a plain paragraph should carry when `block` is reset/converted to
     * one: a code block keeps its raw code; a thematic break is all marker
     * (`---` / `***` / …) with no content, so it yields an empty paragraph;
     * everything else keeps its leading text (heading hashes stripped).
     */
    private _paragraphTextFor(block: Parent): string {
        const state = block.getState();
        if (isCodeBlockState(state))
            return state.text;
        if (block.blockName === 'thematic-break')
            return '';

        return this._blockLeadingText(block);
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

        this._withPreservedOffset(() => replaceBlockByLabel({
            block: leaf,
            muya: this,
            label: 'paragraph',
            text: this._paragraphTextFor(leaf),
        }));
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

        const cursorText = (this.editor.activeContentBlock ?? this.editor.selection.anchorBlock)?.text;
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

        // Keep the caret in the lifted block that still holds the cursor's text
        // (its content was cloned), falling back to the first lifted block.
        const restored = (cursorText != null ? this._findContentByText(cursorText) : null)
            ?? firstNew?.firstContentInDescendant();
        restored?.setCursor(0, 0, true);
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

        // The live DOM selection carries a click-placed caret, so it is the
        // source of truth for a single block. But it COLLAPSES to one block for
        // a cross-block selection — so when the cached endpoints (committed on
        // mouse-up, the same ones the menu/IPC round-trip relies on) span
        // several blocks while live has collapsed, trust the cached endpoints so
        // the whole span survives the rebuild.
        const cachedCrossBlock = !!sel.anchorBlock && !!sel.focusBlock && sel.anchorBlock !== sel.focusBlock;
        const useLive = !!live && !(cachedCrossBlock && live.isSelectionInSameBlock);

        const anchor = useLive ? live!.anchor : sel.anchor;
        const focus = useLive ? live!.focus : sel.focus;
        const anchorPath = useLive ? live!.anchor.path : sel.anchorPath;
        const focusPath = useLive ? live!.focus.path : sel.focusPath;
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

        // Destroy every registered UI plugin so the nodes they appended to
        // `document.body` (float boxes, the image resize bar, tooltips) are
        // removed rather than leaked (#3315).
        for (const plugin of Object.values(this._uiPlugins)) {
            const destroy = (plugin as { destroy?: unknown })?.destroy;
            if (typeof destroy === 'function')
                (destroy as () => void).call(plugin);
        }
    }
}

/**
 * [ensureContainerDiv ensure container element is div]
 */
function getContainer(originContainer: HTMLElement, options: IMuyaOptions) {
    const { spellcheckEnabled, spellcheckHideMarks, hideQuickInsertHint, focusMode } = options;
    const newContainer = document.createElement('div');
    const attrs = originContainer.attributes;
    // Copy attrs from origin container to new container
    Array.from(attrs).forEach((attr: { name: string; value: string }) => {
        newContainer.setAttribute(attr.name, attr.value);
    });

    if (!hideQuickInsertHint)
        newContainer.classList.add(CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT);

    if (spellcheckHideMarks)
        newContainer.classList.add(CLASS_NAMES.MU_HIDE_SPELLING_MARKS);

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
