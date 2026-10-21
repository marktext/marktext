import type Content from './block/base/content';
import type Parent from './block/base/parent';
import type { TBlockPath } from './block/types';
import type { Listener } from './event/types';
import type { ILocale } from './i18n/types';
import type { IReplaceOption, ISearchOption } from './search/types';
import type { IIndexCursor } from './selection/offsetCursor';
import type { IHistorySelection, IPublicCursorInput } from './selection/types';
import type { ITocItem } from './state/getTOC';
import type { IBulletListState, IOrderListState, ITableState, ITaskListState, TState } from './state/types';
import type { IMuyaOptions, Nullable } from './types';
import Format from './block/base/format';
import { canTurnInto, insertBlockBelowByLabel, insertFrontMatterAtStart, replaceBlockByLabel } from './block/blockTransforms';
import { revealBlock } from './block/folding';
import { canConvertGithubAlert, convertGithubAlert } from './block/githubAlerts';
import { ScrollPage } from './block/scrollPage';
import emptyStates from './config/emptyStates';
import {
    CLASS_NAMES,
    DATA_URL_REG,
    MUYA_DEFAULT_OPTIONS,
    URL_REG,
} from './config/index';
import { Editor } from './editor/index';
import { attachReadingEvents, prepareReadingLinks } from './editor/readOnly';
import EventCenter from './event/index';

import I18n from './i18n/index';
import {
    injectSentinels,
    injectStateSentinels,
    locateSentinelOffsets,
    resolveSentinelCursor,
} from './selection/offsetCursor';
import { isAnyListState, isAtxHeadingState, isCodeBlockState, isSetextHeadingState } from './state/types';
import { ChangeSource } from './types';
import { Ui } from './ui/ui';
import { deepClone } from './utils';
import { getBlock } from './utils/dom';
import { GITHUB_ALERT_TYPES, githubAlertBlockType, githubAlertMarker } from './utils/githubAlerts';
import { encodeImageSrc } from './utils/image';
import './assets/styles/blockSyntax.css';
import './assets/styles/index.css';
import './assets/styles/inlineSyntax.css';
import './assets/styles/githubAlerts.css';
import './assets/styles/prismjs/light.theme.css';

export interface IMuyaPluginConstructor {
    pluginName: string;
    new(muya: Muya, options: Record<string, unknown>): unknown;
}

interface IPlugin {
    plugin: IMuyaPluginConstructor;
    options: Record<string, unknown>;
}

// Paths survive block-tree rebuilds; block references do not.
interface ISelectionSnapshot {
    anchor: number;
    focus: number;
    anchorPath: (string | number)[];
    focusPath: (string | number)[];
}

// Maps the paragraph-menu labels the desktop sends through `updateParagraph`
// to muya's `replaceBlockByLabel` vocabulary.
const PARAGRAPH_LABEL_MAP: Record<string, string> = {
    ...GITHUB_ALERT_TYPES.reduce<Record<string, string>>((labels, type) => {
        labels[`github-alert ${type}`] = `github-alert ${type}`;
        return labels;
    }, {}),
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

// Inner leaves are not standalone document blocks; paragraph commands must target their container.
const WHOLE_BLOCK_NAMES = new Set([
    'table',
    'code-block',
    'html-block',
    'math-block',
    'diagram',
    'frontmatter',
]);

const HEADING_LEVEL_BLOCK_NAMES = new Set(['paragraph', 'atx-heading', 'setext-heading']);

// These options change block structure, so a render-only rebuild cannot apply them.
const PARSE_AFFECTING_OPTIONS = new Set<keyof IMuyaOptions>([
    'texMathGfm',
    'texMathDollars',
    'footnote',
    'frontMatter',
    'trimUnnecessaryCodeBlockEmptyLines',
    'multilineBlockquote',
    'githubAlerts',
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
    private _documentUpdateDepth = 0;
    private _cancelReadingLink: () => void;

    get isReadOnly(): boolean {
        return this.options.readOnly;
    }

    get canMutate() {
        return !this.isReadOnly || this._documentUpdateDepth > 0;
    }

    isBlockInDocument(block: Nullable<Content | Parent>): boolean {
        return !!block?.domNode && this.domNode.isConnected && this.domNode.contains(block.domNode);
    }

    /** Host content loads may replace a locked document; user commands cannot. */
    runDocumentUpdate<T>(update: () => T): T {
        this._documentUpdateDepth++;
        try {
            return update();
        }
        finally {
            this._documentUpdateDepth--;
        }
    }

    setReadOnly(readOnly: boolean) {
        if (readOnly === this.isReadOnly)
            return;
        this.flush();
        this.editor.activeContentBlock = null;
        this.options.readOnly = readOnly;
        this.hideAllFloatTools();
        this.editor.selection.clearImage();
        this.editor.selection.table.clear();
        this._refreshReadingPresentation();
        this.eventCenter.emit('read-only-changed', readOnly);
    }

    constructor(element: HTMLElement, options?: Partial<IMuyaOptions>) {
        this.options = Object.assign({}, MUYA_DEFAULT_OPTIONS, options ?? {});
        this.eventCenter = new EventCenter();
        this.domNode = getContainer(element, this.options);
        this.editor = new Editor(this);
        this.ui = new Ui(this);
        this.i18n = new I18n(this, this.options.locale);
        this._bindFocusBlurEvents();
        this._cancelReadingLink = attachReadingEvents(this);
    }

    private _refreshReadingPresentation(): void {
        const { domNode, isReadOnly } = this;
        domNode.contentEditable = String(!isReadOnly);
        domNode.classList.toggle('mu-read-only', isReadOnly);
        domNode.setAttribute('tabindex', '0');
        domNode.setAttribute('role', isReadOnly ? 'document' : 'textbox');
        domNode.setAttribute('aria-label', this.i18n.t(isReadOnly ? 'Read-only document' : 'Document'));
        this.editor.scrollPage?.breadthFirstTraverse((node) => {
            if (node.isParent() && isReadOnly)
                node.active = false;
            if (node.isContent()) {
                node.domNode?.setAttribute('contenteditable', String(!isReadOnly));
                if (isReadOnly)
                    node.update({});
            }
        });
        if (isReadOnly)
            prepareReadingLinks(domNode);
    }

    private _bindFocusBlurEvents() {
        this.eventCenter.attachDOMEvent(this.domNode, 'focus', () => {
            this.eventCenter.emit('focus');
        });
        this.eventCenter.attachDOMEvent(this.domNode, 'blur', () => {
            this.eventCenter.emit('blur');
        });
    }

    init(options: { focus?: boolean } = {}) {
        this.runDocumentUpdate(() => this.editor.init({ ...options, focus: !this.isReadOnly && options.focus !== false }));
        this._refreshReadingPresentation();
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

    on(event: string, listener: Listener) {
        this.eventCenter.on(event, listener);
    }

    off(event: string, listener: Listener) {
        this.eventCenter.off(event, listener);
    }

    once(event: string, listener: Listener) {
        this.eventCenter.once(event, listener);
    }

    getState() {
        return this.editor.jsonState.getState();
    }

    getMarkdown() {
        return this.editor.jsonState.getMarkdown();
    }

    // Flush queued edits synchronously; call before swapping the document out
    // (e.g. a tab switch) so a same-frame keystroke isn't lost (#2938).
    flush() {
        this.editor.jsonState.flush();
    }

    getTOC(): ITocItem[] {
        return this.editor.jsonState.getTOC();
    }

    undo() {
        if (!this.canMutate)
            return;
        this.editor.history.undo();
    }

    redo() {
        if (!this.canMutate)
            return;
        this.editor.history.redo();
    }

    getHistory() {
        return this.editor.history.getHistory();
    }

    setHistory(history: ReturnType<Muya['getHistory']>) {
        this.editor.history.setHistory(history);
    }

    clearHistory() {
        this.editor.history.clear();
    }

    /** Reveal an editor element before the host measures it for scrolling. */
    revealElement(element: Element): void {
        if (!this.domNode.contains(element))
            return;
        let target: Element | null = element;
        while (target && target !== this.domNode) {
            const block = getBlock(target);
            if (block) {
                revealBlock(block);
                return;
            }
            target = target.parentElement;
        }
    }

    search(value: string, opts: ISearchOption = {}) {
        return this.editor.searchModule.search(value, opts);
    }

    find(action: 'previous' | 'next') {
        return this.editor.searchModule.find(action);
    }

    replace(replaceValue: string, opt: IReplaceOption = { isSingle: true, isRegexp: false }) {
        if (!this.canMutate)
            return;
        return this.editor.searchModule.replace(replaceValue, opt);
    }

    setContent(content: TState[] | string, autoFocus = false) {
        this.runDocumentUpdate(() => this.editor.setContent(content, autoFocus && !this.isReadOnly));
        this._refreshReadingPresentation();
    }

    /**
     * Replace the document as one undo step, preserving existing history.
     * No-op when the content is unchanged.
     *
     * `recordSelection` is the selection restored by undo. Omit it to use the
     * live selection, or pass the saved WYSIWYG selection when focus has moved
     * to source mode.
     *
     * @returns Whether an undo boundary was recorded.
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
        this.runDocumentUpdate(() => history.suppressRecording(() => {
            this.editor.rebuildContents(op, this.isReadOnly ? null : selection, ChangeSource.Api);
        }));
        this._refreshReadingPresentation();

        return true;
    }

    setOptions(options: Partial<IMuyaOptions>, forceRender = false) {
        if (typeof options.readOnly === 'boolean')
            this.setReadOnly(options.readOnly);
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

        applyAppearance(this.domNode, options);
        if (!forceRender)
            return;

        if (Object.keys(options).some(key => PARSE_AFFECTING_OPTIONS.has(key as keyof IMuyaOptions))) {
            const { jsonState } = this.editor;
            jsonState.setContent(jsonState.markdownToState(this.getMarkdown()));
        }

        this._forceRender();
    }

    private _forceRender() {
        this.runDocumentUpdate(() => this._renderDocument());
        this._refreshReadingPresentation();
    }

    private _renderDocument() {
        const selection = this.editor.selection.getSelection();
        this.editor.scrollPage?.updateState(this.getState());

        this.editor.searchModule.refresh();

        if (!this.isReadOnly && selection && selection.isSelectionInSameBlock) {
            const begin = Math.min(selection.anchor.offset, selection.focus.offset);
            const end = Math.max(selection.anchor.offset, selection.focus.offset);
            const cursorBlock = this.editor.scrollPage?.queryBlock(selection.anchor.path);
            if (cursorBlock && cursorBlock.isContent())
                cursorBlock.setCursor(begin, end, true);
        }
    }

    setListIndentation(listIndentation: IMuyaOptions['listIndentation']) {
        this.setOptions({ listIndentation }, true);
    }

    focus() {
        if (this.isReadOnly) {
            this.domNode.focus({ preventScroll: true });
            return;
        }
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
        if (!this.canMutate)
            return;
        const { selection } = this.editor;

        // Cached leaf endpoints survive the menu/IPC round-trip and distinguish
        // paragraphs inside the same blockquote (#3462).
        if (!this._selectionInSameLeaf()) {
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

        // Formatting inserts markers, so restore the span using post-format offsets.
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

    private _headingMarkerLen(leaf: Content): number {
        if (leaf.parent?.blockName !== 'atx-heading')
            return 0;

        return /^ {0,3}#{1,6}(?:\s+|$)/.exec(leaf.text)?.[0].length ?? 0;
    }

    /**
     * Replace only when the word at the cursor still matches `word`, then move
     * the cursor after the replacement. Returns whether it was applied.
     */
    replaceCurrentWordInlineUnsafe(word: string, replacement: string): boolean {
        if (!this.canMutate)
            return false;
        const block = this.editor.activeContentBlock;
        if (!block)
            return false;

        return block.replaceCurrentWordInlineUnsafe(word, replacement);
    }

    getSelection() {
        return this.editor.selection.getSelection();
    }

    /**
     * The source text of the current text selection: blank lines between
     * paragraphs, single newlines inside code, tables and tight lists.
     */
    getSelectedText(): string {
        return this.editor.selection.getSelectedText();
    }

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

    hideAllFloatTools() {
        this.ui.hideAllFloatTools();
    }

    /** Reload images whose files changed on disk despite cached bitmaps. */
    invalidateImageCache() {
        this.editor.inlineRenderer.invalidateImageCache();
    }

    copyAsMarkdown() {
        this.editor.clipboard.copyAsMarkdown();
    }

    /** Copy rendered HTML as literal markup in the plain-text clipboard slot. */
    copyAsHtml() {
        this.editor.clipboard.copyAsHtml();
    }

    /** Copy rendered HTML as rich text, with Markdown as the plain-text fallback. */
    copyAsRich() {
        this.editor.clipboard.copyAsRich();
    }

    pasteAsPlainText(): Promise<void> {
        if (!this.canMutate)
            return Promise.resolve();
        return this.editor.clipboard.pasteAsPlainText();
    }

    /** Insert a file path or data URL through the configured `imageAction`. */
    pasteImage(src: string): Promise<void> {
        if (!this.canMutate)
            return Promise.resolve();
        return this.editor.clipboard.pasteImage(src);
    }

    private _outmostBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;

        return content?.outMostBlock ?? null;
    }

    // Table cells and inner code nodes cannot have document blocks inserted beside them.
    // Return null for detached cached caret blocks (#5355).
    private _immediateBlockAtCursor(): Parent | null {
        const content = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;
        if (!content?.outMostBlock)
            return null;

        return content.getAnchor() ?? null;
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

    /** Prefer cross-block endpoints when the live range collapses during a menu/IPC round-trip. */
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

    private _selectionInSameBlock(): boolean {
        const endpoints = this._selectionEndpoints();
        if (!endpoints)
            return true;

        return endpoints.anchor === endpoints.focus;
    }

    /** Nested paragraphs share an outmost block but need separate inline formatting (#3462). */
    private _selectionInSameLeaf(): boolean {
        const sel = this.editor.selection;
        const liveSel = sel.getSelection();
        const liveAnchor = liveSel?.anchor.block;
        const liveFocus = liveSel?.focus.block;
        if (liveAnchor && liveFocus && liveAnchor !== liveFocus)
            return false;
        const cachedAnchor = sel.anchorBlock;
        const cachedFocus = sel.focusBlock;
        if (cachedAnchor && cachedFocus && cachedAnchor !== cachedFocus)
            return false;

        return true;
    }

    /** ScrollPage children covered by the selection, in document order. */
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

    /** Replace selected outmost blocks with one container, then restore the selection via `place`. */
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

    private _getStateForWrapping(block: Parent): TState {
        const state = block.getState();
        if (state.name !== 'github-alert')
            return state;
        const marker = githubAlertMarker(state.meta);
        const first = state.children[0];
        const children = !state.meta.blankLineAfterMarker && first?.name === 'paragraph'
            ? [{ ...first, text: `${marker}\n${first.text}` }, ...state.children.slice(1)]
            : [{ name: 'paragraph' as const, text: marker }, ...state.children];
        return { name: 'block-quote', children };
    }

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
                    ? { name: itemName, meta: { checked: false }, children: [this._getStateForWrapping(b)] }
                    : { name: itemName, children: [this._getStateForWrapping(b)] }),
            }),
            container => this._selectWrappedContent(container),
        );
    }

    private _wrapSelectedBlocksInQuote() {
        this._wrapSelectedBlocks(
            blocks => ({ name: 'block-quote', children: blocks.map(block => this._getStateForWrapping(block)) }),
            container => this._selectWrappedContent(container),
        );
    }

    /** Join the selected outmost blocks' text into a single fenced code block. */
    private _wrapSelectedBlocksInCodeBlock() {
        this._wrapSelectedBlocks(
            blocks => ({
                name: 'code-block',
                meta: { type: 'fenced', lang: '', fenceChar: '`' },
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
        if (!this.canMutate)
            return;
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
        if (!this.canMutate)
            return;
        const block = outMost
            ? this._outmostBlockAtCursor()
            : this._immediateBlockAtCursor();
        if (!block || (location === 'before' && block.blockName === 'frontmatter'))
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
        if (!this.canMutate)
            return;
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
     * Insert a table at `block` (default: the block holding the caret): in its
     * place when it is empty or `replace` is set, otherwise directly below it.
     * No-op when that block is no longer in the document.
     */
    createTable(
        { rows, columns }: { rows: number; columns: number },
        { replace = false, block = this._immediateBlockAtCursor() }: { replace?: boolean; block?: Parent | null } = {},
    ) {
        if (!this.canMutate)
            return;
        if (!block?.outMostBlock)
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
        if (replace || (!WHOLE_BLOCK_NAMES.has(block.blockName) && this._blockLeadingText(block).trim() === ''))
            block.replaceWith(newTable);
        else
            block.parent!.insertAfter(newTable, block);

        newTable.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Insert an inline image in a formattable block; no-op elsewhere.
     * Selected text takes precedence over `alt`; otherwise an empty alt uses the file name.
     */
    insertImage({ src = '', alt = '' }: { src?: string; alt?: string }) {
        if (!this.canMutate)
            return;
        const block = this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;
        if (!(block instanceof Format))
            return;

        const cursor = block.getCursor();
        if (cursor == null)
            return;

        if (!alt) {
            const match = /[/\\]?([^./\\]+)\.[a-z]+$/i.exec(src);
            alt = match?.[1] ?? '';
        }

        // Keep valid data URLs intact; incomplete data prefixes must be encoded as paths.
        let imgUrl: string;
        if (URL_REG.test(src))
            imgUrl = encodeURI(src);
        else if (DATA_URL_REG.test(src))
            imgUrl = src;
        else
            imgUrl = encodeImageSrc(src);

        const { start, end } = cursor;
        const { text } = block;
        const imageAlt = start.offset !== end.offset ? text.substring(start.offset, end.offset) : alt;
        const imageText = `![${imageAlt}](${imgUrl})`;

        block.text = text.substring(0, start.offset) + imageText + text.substring(end.offset);
        block.setCursor(start.offset + 2, start.offset + 2 + imageAlt.length, true);
    }

    /** Restore a cursor against the live block tree; no-op when its target cannot be resolved. */
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
     * Restore a source-mode line/ch cursor without changing the document or
     * undo history. Returns false when the cursor cannot be resolved.
     */
    setCursorByOffset(indexCursor: IIndexCursor): boolean {
        const { scrollPage } = this.editor;
        if (!scrollPage)
            return false;

        const cleanMarkdown = this.getMarkdown();
        const sentinelMarkdown = injectSentinels(cleanMarkdown, indexCursor);
        if (sentinelMarkdown == null)
            return false;

        // The tree has no source-line map; a synchronous sentinel rebuild resolves it
        // without an intermediate paint. setContent clears history, so preserve it here.
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
     * Read the selection as source-mode line/ch positions without changing the
     * document or undo history. Returns null when it cannot be located.
     */
    getCursorOffset(): IIndexCursor | null {
        const selection = this.editor.selection.getSelection();
        if (!selection)
            return null;

        // Serialize sentinels in a cloned state because the tree has no source-line map.
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

    private _handleGithubAlertParagraph(block: Parent, label: string | undefined): boolean {
        if (!this.options.githubAlerts || !label)
            return false;
        if (label === 'paragraph' || label === 'block-quote') {
            if (!canConvertGithubAlert(block, label))
                return false;
        }
        else if (!label.startsWith('github-alert ')) {
            return false;
        }
        const selection = this.editor.selection.getSelection();
        const spansContainers = selection && selection.anchor.block.outMostBlock !== selection.focus.block.outMostBlock;
        if (spansContainers && label === 'block-quote' && !githubAlertBlockType(block))
            return false;
        if (!spansContainers)
            convertGithubAlert(block, label);
        return true;
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
        if (!this.canMutate)
            return;
        const block = this._outmostBlockAtCursor();
        if (!block)
            return;

        const label = PARAGRAPH_LABEL_MAP[type];
        if (this._handleGithubAlertParagraph(block, label))
            return;

        if (this._handleCrossBlockParagraph(type))
            return;

        // Only the paragraph or heading holding the caret changes level, even
        // inside a list or quote; any other block at the caret is left as it is,
        // as in muyajs (#5360).
        if (type === 'upgrade heading' || type === 'degrade heading') {
            const target = this._immediateBlockAtCursor();
            if (target && HEADING_LEVEL_BLOCK_NAMES.has(target.blockName))
                this._withPreservedOffset(() => this._changeHeadingLevel(target, type));
            return;
        }

        if (type === 'loose-list-item') {
            this._toggleLooseList(block);
            return;
        }

        if (type === 'reset-to-paragraph') {
            this.resetToParagraph(block);
            return;
        }

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

        // Converting the enclosing list/quote would lose all but its leading text.
        // `paragraph` converts the inner block; `reset-to-paragraph` unwraps the container.
        if (label === 'paragraph')
            return this._convertLeafToParagraph();

        if (this._toggleIfActive(label))
            return;

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
     * Toggle off a matching type, unwrapping all same-kind ancestors so the menu
     * item becomes unchecked. Headings match only at the requested level.
     * Returns whether a matching type was found.
     */
    private _toggleIfActive(label: string): boolean {
        const cursorContent = () => this.editor.activeContentBlock ?? this.editor.selection.anchorBlock;
        const content = cursorContent();
        if (!content)
            return false;

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

    private _closestListAtCursor(): Parent | null {
        let node: Nullable<Parent> = (this.editor.activeContentBlock ?? this.editor.selection.anchorBlock)?.parent;
        while (node) {
            if (node.blockName === 'bullet-list' || node.blockName === 'order-list' || node.blockName === 'task-list')
                return node;
            node = node.parent;
        }

        return null;
    }

    /** Conversions must leave the caret content active so its selection can be restored. */
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

    /** Skip marker-only leaves so restoring a caret cannot land on an unrelated code/math block. */
    private _findContentByText(text: string): Content | null {
        let leaf: Nullable<Content> = this.editor.scrollPage?.firstContentInDescendant();
        while (leaf) {
            if (leaf instanceof Format && leaf.text === text)
                return leaf;
            leaf = leaf.nextContentInContext();
        }

        return null;
    }

    /** Preserve enclosing lists/quotes when converting their inner paragraph or heading. */
    private _convertOrInsertBelow(label: string) {
        const immediate = this._immediateBlockAtCursor();
        if (!immediate || WHOLE_BLOCK_NAMES.has(immediate.blockName))
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
     * Unwrap lists and quotes without losing children; leave tables untouched.
     * Other blocks become paragraphs carrying their leading text.
     */
    resetToParagraph(block: Parent) {
        if (!this.canMutate)
            return;
        if (block.blockName === 'table')
            return;

        if (isAnyListState(block.getState()) || block.blockName === 'block-quote') {
            this._unwrapToParagraphs(block);
            return;
        }

        replaceBlockByLabel({ block, muya: this, label: 'paragraph', text: this._paragraphTextFor(block) });
    }

    /** Preserve raw code, discard thematic-break markers, and strip heading hashes. */
    private _paragraphTextFor(block: Parent): string {
        const state = block.getState();
        if (isCodeBlockState(state))
            return state.text;
        if (block.blockName === 'thematic-break')
            return '';

        return this._blockLeadingText(block);
    }

    /** Convert the inner block without unwrapping its enclosing list or quote. */
    private _convertLeafToParagraph() {
        const leaf = this._immediateBlockAtCursor();
        if (!leaf || leaf.blockName === 'paragraph' || WHOLE_BLOCK_NAMES.has(leaf.blockName))
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
        // A detached block has no parent to reparent its children into (#4686).
        const parent = block.parent;
        if (!parent)
            return;

        const state = block.getState();
        let inner: TState[] = [];
        if (isAnyListState(state))
            inner = state.children.flatMap(li => deepClone(li.children));
        else if (state.name === 'block-quote')
            inner = deepClone(state.children);

        if (!inner.length)
            return;

        const cursorText = (this.editor.activeContentBlock ?? this.editor.selection.anchorBlock)?.text;
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

    private _blockLeadingText(block: Parent): string {
        const text = block.firstContentInDescendant()?.text ?? '';

        return block.blockName === 'atx-heading'
            ? text.replace(/^ {0,3}#{1,6}(?:\s+|$)/, '')
            : text;
    }

    private _changeHeadingLevel(block: Parent, type: 'upgrade heading' | 'degrade heading') {
        const state = block.getState();
        const level = isAtxHeadingState(state) || isSetextHeadingState(state) ? state.meta.level : 0;
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

    private _toggleLooseList(block: Parent) {
        const state = block.getState();
        if (!isAnyListState(state))
            return;

        // A loose/tight toggle rebuilds blocks without changing their paths.
        const snapshot = this._snapshotSelection();

        const newState = deepClone(state);
        newState.meta.loose = !newState.meta.loose;
        const newBlock = ScrollPage.loadBlock(newState.name).create(this, newState);
        block.replaceWith(newBlock);

        if (!this._restoreSelection(snapshot))
            newBlock.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    /** Capture paths and offsets so the selection survives a block-tree rebuild. */
    private _snapshotSelection(): ISelectionSnapshot | null {
        const sel = this.editor.selection;
        const live = sel.getSelection();

        // A menu/IPC round-trip can collapse the live range; retain cached cross-block endpoints.
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

    /** Return false if snapshot paths no longer resolve to content blocks. */
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
        this._cancelReadingLink();
        this.eventCenter.detachAllDomEvents();
        this.eventCenter.unsubscribeAll();
        if (this.domNode.remove)
            this.domNode.remove();

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

function applyAppearance(domNode: HTMLElement, options: Partial<IMuyaOptions>) {
    const { style } = domNode;
    if (typeof options.fontSize === 'number')
        style.setProperty('--mu-font-size', `${options.fontSize}px`);
    if (typeof options.lineHeight === 'number')
        style.setProperty('--mu-line-height', `${options.lineHeight}`);
    if (options.editorFontFamily)
        style.setProperty('--mu-font-family', options.editorFontFamily);
    if (typeof options.codeFontSize === 'number')
        style.setProperty('--mu-code-font-size', `${options.codeFontSize}px`);
    if (options.codeFontFamily)
        style.setProperty('--mu-code-font-family', options.codeFontFamily);
    if ('wrapCodeBlocks' in options)
        domNode.classList.toggle(CLASS_NAMES.MU_CODE_WRAP, !!options.wrapCodeBlocks);
}

function getContainer(originContainer: HTMLElement, options: IMuyaOptions) {
    const { spellcheckEnabled, spellcheckHideMarks, hideQuickInsertHint, focusMode } = options;
    const newContainer = document.createElement('div');
    const attrs = originContainer.attributes;
    Array.from(attrs).forEach((attr: { name: string; value: string }) => {
        newContainer.setAttribute(attr.name, attr.value);
    });

    if (!hideQuickInsertHint)
        newContainer.classList.add(CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT);

    if (spellcheckHideMarks)
        newContainer.classList.add(CLASS_NAMES.MU_HIDE_SPELLING_MARKS);

    if (focusMode)
        newContainer.classList.add(CLASS_NAMES.MU_FOCUS_MODE);

    newContainer.classList.add(CLASS_NAMES.MU_EDITOR);

    newContainer.setAttribute('contenteditable', options.readOnly ? 'false' : 'true');
    newContainer.setAttribute('autocorrect', 'false');
    newContainer.setAttribute('autocomplete', 'off');
    newContainer.setAttribute('spellcheck', spellcheckEnabled ? 'true' : 'false');
    originContainer.replaceWith(newContainer);

    applyAppearance(newContainer, options);

    return newContainer;
}
