import type { JSONOp, JSONOpComponent, JSONOpList } from 'ot-json1';
import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type { Muya } from '../muya';
import type { TSelectionState } from '../selection/types';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import type { ICompletedTransaction, ITransactionOptions } from './transactions';
import * as otText from 'ot-text-unicode';
import { fromEvent, merge } from 'rxjs';
import { registerBlocks } from '../block';
import { ScrollPage } from '../block/scrollPage';
import Clipboard from '../clipboard';
import { CLASS_NAMES, isFirefox } from '../config';
import History from '../history';
import InlineRenderer from '../inlineRenderer';
import { Search } from '../search';
import Selection from '../selection';
import { findContentDOM } from '../selection/dom';
import JSONState from '../state';
import { createChangePayload } from '../state/changePayload';
import { stateAtPath } from '../state/paths';
import { ChangeSource } from '../types';
import { deepClone, hasPick, isHTMLElement } from '../utils';
import { getBlock } from '../utils/dom';
import logger from '../utils/logger';
import { attachDragDropImageHandlers } from './dragDropImage';
import { attachLinkMouseHandlers } from './linkMouseEvents';
import { EditTransactions } from './transactions';

const debug = logger('editor:');

// The pick/drop walkers operate on live block-tree nodes (ScrollPage,
// Parent, Content). The tree's instance methods (queryBlock, find,
// insertBefore, etc.) are not all exposed on a single TS type, and
// ot-json1 op descents are dynamically shaped — so we type these as
// BlockNode (loose structural alias) inside the inner walkers and let
// the runtime branches do the actual narrowing.
type BlockNode = {
    queryBlock?: (path: (string | number)[]) => BlockNode | undefined;
    find?: (key: number | string) => BlockNode;
    remove?: (source: ChangeSource) => void;
    replaceWith?: (newBlock: BlockNode, source: ChangeSource) => void;
    insertBefore?: (newBlock: BlockNode, ref: BlockNode, source: ChangeSource) => void;
    append?: (newBlock: BlockNode, source: ChangeSource) => void;
    update?: (value?: unknown, source?: ChangeSource) => void;
    setLoose?: (loose: boolean) => void;
    setChecked?: (checked: boolean) => void;
    setSyntax?: (syntax: unknown) => void;
    path?: (string | number)[];
    blockName?: string;
    align?: string;
    _text?: string;
    text?: string;
    meta?: { lang?: string; type?: string };
    parent?: BlockNode;
} | undefined;

function descend(
    subDoc: BlockNode,
    descent: JSONOpList,
    stack: BlockNode[],
): { subDoc: BlockNode; i: number } {
    let i = 0;

    for (; i < descent.length; i++) {
        const d = descent[i];
        if (Array.isArray(d))
            break;
        if (typeof d === 'object')
            continue;
        stack.push(subDoc);
        // Its valid to descend into a null space - just we can't pick there.
        subDoc = subDoc == null ? undefined : subDoc.queryBlock?.([d]);
    }

    return { subDoc, i };
}

function restore(
    subDoc: BlockNode,
    descent: JSONOpList,
    stack: BlockNode[],
    i: number,
): BlockNode {
    // Then back again.
    for (--i; i >= 0; i--) {
        const d = descent[i];
        if (typeof d !== 'object') {
            const container = stack.pop();
            if (
                subDoc
                === (container == null ? undefined : container.queryBlock?.([d as string | number]))
            ) {
                subDoc = container;
            }
            else {
                if (subDoc === undefined) {
                    // TODO: handler typeof d === 'string'
                    if (typeof d === 'number')
                        container?.find?.(d)?.remove?.(ChangeSource.Api);
                    subDoc = container;
                }
                else {
                    if (typeof d === 'number')
                        container?.find?.(d)?.replaceWith?.(subDoc, ChangeSource.Api);
                    subDoc = container;
                }
            }
        }
        else if (!Array.isArray(d) && hasPick(d)) {
            subDoc = undefined;
        }
    }

    return subDoc;
}

// Phase 1: Pick. Returns updated subDocument.
function pick(subDoc: BlockNode, descent: JSONOpList): BlockNode {
    if (descent.includes('syntax'))
        return subDoc;
    const stack: BlockNode[] = [];

    const descended = descend(subDoc, descent, stack);
    subDoc = descended.subDoc;
    const i = descended.i;

    // Children. These need to be traversed in reverse order here.
    for (let j = descent.length - 1; j >= i; j--)
        subDoc = pick(subDoc, descent[j] as JSONOpList);

    return restore(subDoc, descent, stack, i);
}

function drop(root: BlockNode, descent: JSONOpList, muya: Muya, snapshot: () => TState[]): BlockNode {
    const syntaxIndex = descent.indexOf('syntax');
    if (syntaxIndex >= 0) {
        const { subDoc: block } = descend(root, descent.slice(0, syntaxIndex), []);
        const state = block?.path ? stateAtPath(snapshot(), block.path) : undefined;
        if (!block?.setSyntax || !state || typeof state !== 'object' || !('syntax' in state))
            throw new Error('Cannot project heading syntax onto this Block');
        block.setSyntax(state.syntax);
        return root;
    }
    let subDoc = root;
    let i = 0; // For reading
    let m = 0;
    const rootContainer: { root: BlockNode } = { root }; // This is an avoidable allocation.
    let container: BlockNode | { root: BlockNode } = rootContainer;
    let key: string | number = 'root'; // For writing

    function mut() {
        for (; m < i; m++) {
            const d = descent[m];
            if (typeof d === 'object')
                continue;
            if (key === 'root') {
                const wrap = container as { root: BlockNode };
                container = wrap.root;
            }
            else {
                container = (container as BlockNode)?.queryBlock?.([key]);
            }
            key = d as string | number;
        }
    }

    function applyInsert(comp: JSONOpComponent) {
        // Insert
        mut();
        const cur = container as BlockNode;
        const ref = cur?.find?.(key);
        if (typeof key === 'number') {
            const insertedState = comp.i as { name: string };
            const newBlock = ScrollPage.loadBlock(insertedState.name).create(muya, insertedState) as BlockNode;
            if (cur && newBlock) {
                if (ref)
                    cur.insertBefore?.(newBlock, ref, ChangeSource.Api);
                else
                    cur.append?.(newBlock, ChangeSource.Api);
            }

            subDoc = newBlock;
        }
        else {
            switch (key) {
                case 'checked': {
                    if (typeof comp.i === 'boolean')
                        cur?.setChecked?.(comp.i);
                    break;
                }

                case 'loose': {
                    if (typeof comp.i === 'boolean')
                        cur?.setLoose?.(comp.i);
                    break;
                }

                case 'meta':
                    // Do nothing.
                    break;

                default:
                    debug.warn(`Unknown operation path ${key}`);
                    break;
            }
        }
    }

    function applyTextEdit(es: NonNullable<JSONOpComponent['es']>) {
        // Edit. Ok because its illegal to drop inside mixed region
        mut();
        const sd = subDoc!;
        if (sd.blockName === 'table.cell') {
            sd.align = otText.type.apply(sd.align ?? '', es) as string;
        }
        else if (sd.blockName === 'language-input') {
            sd._text = otText.type.apply(sd.text ?? '', es) as string;
            if (sd.parent?.meta)
                sd.parent.meta.lang = sd.text;
            sd.update?.();
        }
        else if (sd.blockName === 'code-block') {
            // Handle modify code block type.
            if (sd.meta)
                sd.meta.type = otText.type.apply(sd.meta.type ?? '', es) as string;
        }
        else {
            sd._text = otText.type.apply(sd.text ?? '', es) as string;
            sd.update?.();
        }
    }

    for (; i < descent.length; i++) {
        const d = descent[i];

        if (Array.isArray(d)) {
            const child = drop(subDoc, d, muya, snapshot);
            if (child !== subDoc && child !== undefined) {
                mut();
                // It maybe never go into this if statement.
                if (key === 'root')
                    (container as { root: BlockNode }).root = child;
                else
                    (container as Record<string, BlockNode>)[key] = child;
                subDoc = child;
            }
        }
        else if (typeof d === 'object') {
            const comp = d as JSONOpComponent;
            if (comp.i !== undefined)
                applyInsert(comp);

            if (comp.es)
                applyTextEdit(comp.es);
        }
        else {
            subDoc = subDoc != null ? subDoc.queryBlock?.([d]) : undefined;
        }
    }

    return rootContainer.root;
}

export class Editor {
    jsonState: JSONState;
    transactions: EditTransactions;
    isUpdating = false;

    get isComposing() { return this._isComposing; }
    inlineRenderer: InlineRenderer;
    selection: Selection;
    searchModule: Search;
    clipboard: Clipboard;
    history: History;
    scrollPage: Nullable<ScrollPage> = null;

    private _activeContentBlock: Nullable<Content> = null;
    private _inputSelection: Nullable<TSelectionState> | undefined;
    private _isComposing = false;

    constructor(private _muya: Muya) {
        const state = _muya.options.json || _muya.options.markdown || '';

        this.jsonState = new JSONState(_muya, state);
        this.transactions = new EditTransactions(
            this.jsonState,
            () => _muya.options,
            transaction => this._commitTransaction(transaction),
            () => _muya.runDocumentUpdate(() => this.scrollPage?.updateState(this.jsonState.getState())),
            (operation, options, preview) => this._updateBlocks(
                operation,
                options.view ?? 'incremental',
                options.selection ?? null,
                () => deepClone(preview) as TState[],
            ),
            () => this.selection.getSelectionState(),
        );
        this.inlineRenderer = new InlineRenderer(_muya);
        this.selection = new Selection(_muya);
        this.searchModule = new Search(_muya);
        this.clipboard = Clipboard.create(_muya);
        this.history = new History(_muya);
    }

    get activeContentBlock() {
        return this._activeContentBlock;
    }

    set activeContentBlock(block) {
        const { activeContentBlock: oldActiveContentBlock } = this;
        if (block !== oldActiveContentBlock) {
            this._activeContentBlock = block;
            if (oldActiveContentBlock)
                oldActiveContentBlock.blurHandler();

            if (block)
                block.focusHandler();
        }
    }

    init(options: { focus?: boolean } = {}) {
        registerBlocks();

        const muya = this._muya;
        const state = this.jsonState.getState();

        this.scrollPage = ScrollPage.create(muya, state);

        this._dispatchEvents();
        // Hovering a rendered link wrapper dispatches `muya-link-tools` so the
        // staged popover lights up. Cleanup is handled by `muya.destroy()` →
        // `detachAllDomEvents`.
        attachLinkMouseHandlers(muya);
        // Dropping an image file or web-link image into the editor inserts it
        // as a new `![](src)` block. Cleanup is likewise handled by
        // `detachAllDomEvents`.
        attachDragDropImageHandlers(muya);
        if (options.focus !== false)
            this.focus();
    }

    private _dispatchEvents() {
        const { domNode } = this._muya;

        // Native input moves the DOM caret before the input handler runs (#5258).
        this._muya.eventCenter.attachDOMEvent(domNode, 'beforeinput', () => {
            if (this._muya.isReadOnly || this._isComposing)
                return;
            this.transactions.flush();
            this._inputSelection = this.selection.getSelectionState();
        }, true);

        const eventHandler = (event: Event) => {
            if (this._muya.isReadOnly)
                return;
            if (!this._isContentEvent(event))
                return;
            if (this._handlePreviewClick(event))
                return;
            const selectionResult = this.selection.getTextSelection();
            const anchorBlock = selectionResult?.anchor.block;
            const isSelectionInSameBlock = selectionResult?.isSelectionInSameBlock;
            // Fix issue that language input can not get focus when it's empty(Firefox only)
            if (
                event.type === 'click'
                && isFirefox
                && isHTMLElement(event.target)
                && event.target.textContent === ''
                && event.target.classList.contains(CLASS_NAMES.MU_LANGUAGE_INPUT)
            ) {
                (getBlock(event.target) as Content | undefined)?.setCursor(0, 0, true);
                return;
            }

            if (!isSelectionInSameBlock || !anchorBlock) {
                this.activeContentBlock = null;
                return;
            }

            this.activeContentBlock = anchorBlock;

            switch (event.type) {
                case 'click': {
                    anchorBlock.clickHandler(event);
                    break;
                }
                case 'input': {
                    anchorBlock.inputHandler(event);
                    break;
                }
                case 'keydown': {
                    anchorBlock.keydownHandler(event);
                    break;
                }
                case 'keyup': {
                    anchorBlock.keyupHandler(event);
                    break;
                }
                case 'compositionend':
                case 'compositionstart': {
                    anchorBlock.composeHandler(event);
                    break;
                }
            }
        };

        merge(
            fromEvent(domNode, 'click'),
            fromEvent(domNode, 'input'),
            fromEvent(domNode, 'keydown'),
            fromEvent(domNode, 'keyup'),
            fromEvent(domNode, 'compositionend'),
            fromEvent(domNode, 'compositionstart'),
        ).subscribe((event) => {
            if (event.type === 'compositionstart') {
                this._inputSelection = this.selection.getSelectionState();
                this._isComposing = true;
            }
            const consumesInput = event.type === 'input' || event.type === 'compositionend';
            const selection = consumesInput && this._inputSelection !== undefined
                ? this._inputSelection
                : this.selection.getSelectionState();
            try {
                this.transact(() => eventHandler(event), false, selection);
            }
            finally {
                if (event.type === 'compositionend')
                    this._isComposing = false;
                if (consumesInput && !this._isComposing) {
                    this._inputSelection = undefined;
                    this.selection.notify();
                }
            }
        });
    }

    private _isContentEvent(event: Event): boolean {
        return event.target === this._muya.domNode
            || (event.target instanceof Node && !!findContentDOM(event.target));
    }

    private _handlePreviewClick(event: Event): boolean {
        if (event.type !== 'click' || !(event.target instanceof Element)
            || !event.target.closest(`.${CLASS_NAMES.MU_MATH_RENDER}, .${CLASS_NAMES.MU_RUBY_RENDER}`)) {
            return false;
        }
        const block = getBlock(findContentDOM(event.target));
        if (block?.isContent()) {
            this.activeContentBlock = block;
            block.clickHandler(event);
        }
        return true;
    }

    focus() {
        const { selection, scrollPage } = this;
        const { anchorBlock, anchorPath, anchor, focus } = selection;

        // Restore the user's last caret when it is still in the tree, so a
        // focus() triggered after a blur (e.g. the command palette) keeps
        // block-level commands operating on the block the user was editing
        // rather than the first block of the document.
        if (
            anchorBlock
            && anchor
            && focus
            && scrollPage?.queryBlock(anchorPath) === anchorBlock
        ) {
            anchorBlock.setCursor(anchor.offset, focus.offset, true);
            return;
        }

        // TODO: the cursor maybe passed by muya options.cursor, and no need to find the first leaf block.
        const firstLeafBlock = scrollPage?.firstContentInDescendant();

        if (firstLeafBlock == null)
            return;

        const cursor = {
            path: firstLeafBlock.path,
            block: firstLeafBlock,
            anchor: {
                offset: 0,
            },
            focus: {
                offset: 0,
            },
        };

        const needUpdated
            = firstLeafBlock.blockName === 'paragraph.content'
                && (firstLeafBlock as Format).checkNeedRender(cursor);

        firstLeafBlock.setCursor(0, 0, needUpdated);
    }

    transact<T>(command: () => T, isolated = false, recordSelection?: Nullable<TSelectionState>): T {
        this.transactions.flush();
        const selection = recordSelection !== undefined ? recordSelection : this.selection.getSelectionState();
        try {
            const result = this.transactions.run(command, isolated, selection);
            this.selection.notify();
            return result;
        }
        catch (error) {
            if (selection)
                this._restoreSelection(selection);
            else
                this.selection.clear();
            throw error;
        }
    }

    updateContents(operation: JSONOp, selection: Nullable<TSelectionState>, source: ChangeSource) {
        if (!this._muya.canMutate)
            return;
        return this.transactions.apply(operation, { selection, source });
    }

    replayContents(operation: JSONOp, selection: Nullable<TSelectionState>, rebuild = false) {
        if (!this._muya.canMutate)
            return;
        const focused = document.activeElement;
        try {
            return this.transactions.apply(operation, {
                selection,
                history: 'ignore',
                replay: true,
                view: rebuild ? 'rebuild' : 'incremental',
            });
        }
        finally {
            if (focused instanceof HTMLElement && focused !== document.body && focused.isConnected
                && !this._muya.domNode.contains(focused)) {
                focused.focus({ preventScroll: true });
            }
        }
    }

    private _commitTransaction(transaction: ICompletedTransaction) {
        const { operation, blockOperation, view, selection, source, history, recordSelection, replay } = transaction;
        const before = this.jsonState.rawState;
        if (history === 'separate' && operation !== null)
            this.history.recordRebuild(operation, before, recordSelection !== undefined ? recordSelection : selection);

        this.isUpdating = true;
        try {
            const commit = () => {
                this.jsonState.apply(operation);
                this._updateBlocks(blockOperation, view, selection, () => this.jsonState.getState());
                if (replay && !selection)
                    this.selection.clear();
                debug.log(JSON.stringify(operation));
                this._muya.eventCenter.emit(
                    'json-change',
                    createChangePayload(operation, source, before, this.jsonState.rawState, history === 'merge' || history === 'isolated', recordSelection ?? null),
                );
            };
            if (history === 'isolated') {
                this.history.cutoff(recordSelection ?? undefined);
                try {
                    commit();
                }
                finally {
                    this.history.cutoff();
                }
            }
            else {
                commit();
            }
        }
        finally {
            this.isUpdating = false;
        }
        this.selection.notify(operation !== null);
    }

    private _updateBlocks(operation: JSONOp, view: ICompletedTransaction['view'], selection: Nullable<TSelectionState>, recover: () => TState[]) {
        if (view === 'rebuild') {
            this.scrollPage!.updateState(recover());
            this._restoreSelection(selection);
            return;
        }
        if (operation === null)
            return;
        try {
            let completed: TState[] | undefined;
            const snapshot = pick(this.scrollPage as BlockNode, operation);
            drop(snapshot, operation, this._muya, () => completed ??= recover());
            this._restoreSelection(selection);
        }
        catch (error) {
            // A completed snapshot also recovers a provisional Block update;
            // neither path may publish a half-applied tree.
            debug.error(`updateContents incremental apply failed; rebuilding from state: ${String(error)}`);
            this.scrollPage!.updateState(recover());
            this._restoreSelection(selection);
        }
    }

    private _restoreSelection(selection: Nullable<TSelectionState>) {
        if (!selection)
            return;
        if (!this.selection.setSelection(selection))
            this.scrollPage?.firstContentInDescendant()?.setCursor(0, 0, true);
    }

    /**
     * Apply a history op by rebuilding the live block tree wholesale instead of
     * walking it incrementally (`updateContents`). The op is dispatched to the
     * authoritative json state, then `ScrollPage.updateState` re-creates the DOM
     * from that state — the same safe path `setContent` uses. Used for undo/redo
     * of whole-document boundaries (e.g. exiting source-code mode) whose op
     * shapes the incremental pick/drop walker cannot apply without desyncing the
     * DOM from the json state.
     */
    rebuildContents(operation: JSONOp, selection: Nullable<TSelectionState>, source: ChangeSource, options: ITransactionOptions = {}) {
        if (!this._muya.canMutate)
            return;
        return this.transactions.apply(operation, { ...options, selection, source, view: 'rebuild' });
    }

    setContent(content: TState[] | string, autoFocus = false) {
        this.transactions.assertStandalone();
        this.transactions.cancel();
        this.selection.cancel();
        this.isUpdating = true;
        try {
            this.selection.clear();
            this._inputSelection = undefined;
            this._isComposing = false;
            this.jsonState.setContent(content);
            this.scrollPage!.updateState(this.jsonState.getState());
            this.history.clear();
            this.searchModule.reset();
            if (autoFocus)
                this.focus();
        }
        finally {
            this.isUpdating = false;
        }
        this.selection.notify(true);
    }
}
