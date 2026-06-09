import type { JSONOp, JSONOpComponent, JSONOpList } from 'ot-json1';
import type Content from '../block/base/content';
import type Format from '../block/base/format';
import type { Muya } from '../muya';
import type { IHistorySelection } from '../selection/types';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import * as otText from 'ot-text-unicode';
import { fromEvent, merge } from 'rxjs';
import { registerBlocks } from '../block';
import { ScrollPage } from '../block/scrollPage';
import Clipboard from '../clipboard';
import { isFirefox } from '../config';
import History from '../history';
import InlineRenderer from '../inlineRenderer';
import { Search } from '../search';
import Selection from '../selection';
import JSONState from '../state';
import { hasPick, isHTMLElement } from '../utils';
import { getBlock } from '../utils/dom';
import logger from '../utils/logger';
import { attachDragDropImageHandlers } from './dragDropImage';
import { attachLinkMouseHandlers } from './linkMouseEvents';

const debug = logger('editor:');

export class Editor {
    jsonState: JSONState;
    inlineRenderer: InlineRenderer;
    selection: Selection;
    searchModule: Search;
    clipboard: Clipboard;
    history: History;
    scrollPage: Nullable<ScrollPage> = null;

    private _activeContentBlock: Nullable<Content> = null;

    constructor(public muya: Muya) {
        const state = muya.options.json || muya.options.markdown || '';

        this.jsonState = new JSONState(muya, state);
        this.inlineRenderer = new InlineRenderer(muya);
        this.selection = new Selection(muya);
        this.searchModule = new Search(muya);
        this.clipboard = Clipboard.create(muya);
        this.history = new History(muya);
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

    init() {
        registerBlocks();

        const { muya } = this;
        const state = this.jsonState.getState();

        this.scrollPage = ScrollPage.create(muya, state);

        this._dispatchEvents();
        // marktext cb25b3d4 (#1415): hovering a rendered link wrapper
        // dispatches `muya-link-tools` so the staged popover lights up.
        // Cleanup is handled by `muya.destroy()` → `detachAllDomEvents`.
        attachLinkMouseHandlers(muya);
        // marktext PG4 (#4406 follow-up): dropping an image file or web-link
        // image into the editor inserts it as a new `![](src)` block. Cleanup
        // is likewise handled by `detachAllDomEvents`.
        attachDragDropImageHandlers(muya);
        this.focus();
    }

    private _dispatchEvents() {
        const { domNode } = this.muya;

        const eventHandler = (event: Event) => {
            const { anchorBlock, isSelectionInSameBlock }
                = this.selection.getSelection() ?? {};
            // Fix issue that language input can not get focus when it's empty(Firefox only)
            if (
                event.type === 'click'
                && isFirefox
                && isHTMLElement(event.target)
                && event.target.textContent === ''
                && event.target.classList.contains('mu-language-input')
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
        ).subscribe(eventHandler);
    }

    focus() {
    // TODO: the cursor maybe passed by muya options.cursor, and no need to find the first leaf block.
        const firstLeafBlock = this.scrollPage?.firstContentInDescendant();

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

    updateContents(operations: JSONOp, selection: Nullable<IHistorySelection>, source: string) {
        const { muya } = this;
        // ot-json1 no-op (`null`) is forwarded to dispatch — JSONState
        // short-circuits internally so listeners still see a json-change
        // event for the no-op.
        this.jsonState.dispatch(operations, source);

        // Codes bellow are copy from `ot-json1.apply` and modified.
        if (operations === null)
            return;

        // The pick/drop walkers operate on live block-tree nodes (ScrollPage,
        // Parent, Content). The tree's instance methods (queryBlock, find,
        // insertBefore, etc.) are not all exposed on a single TS type, and
        // ot-json1 op descents are dynamically shaped — so we type these as
        // BlockNode (loose structural alias) inside the inner walkers and let
        // the runtime branches do the actual narrowing.
        type BlockNode = {
            queryBlock?: (path: (string | number)[]) => BlockNode | undefined;
            find?: (key: number | string) => BlockNode;
            remove?: (source: string) => void;
            replaceWith?: (newBlock: BlockNode, source: string) => void;
            insertBefore?: (newBlock: BlockNode, ref: BlockNode, source: string) => void;
            update?: (value?: unknown, source?: string) => void;
            blockName?: string;
            align?: string;
            _text?: string;
            text?: string;
            meta?: { lang?: string; type?: string };
            parent?: BlockNode;
        } | undefined;

        // Phase 1: Pick. Returns updated subDocument.
        function pick(subDoc: BlockNode, descent: JSONOpList): BlockNode {
            const stack: BlockNode[] = [];

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

            // Children. These need to be traversed in reverse order here.
            for (let j = descent.length - 1; j >= i; j--)
                subDoc = pick(subDoc, descent[j] as JSONOpList);

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
                                container?.find?.(d)?.remove?.('api');
                            subDoc = container;
                        }
                        else {
                            if (typeof d === 'number')
                                container?.find?.(d)?.replaceWith?.(subDoc, 'api');
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

        const snapshot = pick(this.scrollPage as BlockNode, operations);

        function drop(root: BlockNode, descent: JSONOpList): BlockNode {
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

            for (; i < descent.length; i++) {
                const d = descent[i];

                if (Array.isArray(d)) {
                    const child = drop(subDoc, d);
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
                    if (comp.i !== undefined) {
                        // Insert
                        mut();
                        const cur = container as BlockNode;
                        const ref = cur?.find?.(key);
                        if (typeof key === 'number') {
                            const insertedState = comp.i as { name: string };
                            const newBlock = ScrollPage.loadBlock(insertedState.name).create(muya, insertedState) as BlockNode;
                            if (cur && ref && newBlock)
                                cur.insertBefore?.(newBlock, ref, 'api');

                            subDoc = newBlock;
                        }
                        else {
                            switch (key) {
                                case 'checked': {
                                    ref?.update?.(comp.i, 'api');
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

                    if (comp.es) {
                        // Edit. Ok because its illegal to drop inside mixed region
                        mut();
                        const sd = subDoc!;
                        if (sd.blockName === 'table.cell') {
                            sd.align = otText.type.apply(sd.align ?? '', comp.es) as string;
                        }
                        else if (sd.blockName === 'language-input') {
                            sd._text = otText.type.apply(sd.text ?? '', comp.es) as string;
                            if (sd.parent?.meta)
                                sd.parent.meta.lang = sd.text;
                            sd.update?.();
                        }
                        else if (sd.blockName === 'code-block') {
                            // Handle modify code block type.
                            if (sd.meta)
                                sd.meta.type = otText.type.apply(sd.meta.type ?? '', comp.es) as string;
                        }
                        else {
                            sd._text = otText.type.apply(sd.text ?? '', comp.es) as string;
                            sd.update?.();
                        }
                    }
                }
                else {
                    subDoc = subDoc != null ? subDoc.queryBlock?.([d]) : undefined;
                }
            }

            return rootContainer.root;
        }

        drop(snapshot, operations);

        this._restoreSelection(selection);
    }

    private _restoreSelection(selection: Nullable<IHistorySelection>, treeRebuilt = false) {
        if (!selection)
            return;

        const { anchorPath, anchor, focus, isSelectionInSameBlock } = selection;
        // `ScrollPage.queryBlock` consumes the path array in place (`path.shift`),
        // so query against a copy and leave the caller's selection untouched.
        const cursorBlock = this.scrollPage?.queryBlock([...anchorPath]);

        const begin = Math.min(anchor.offset, focus.offset);
        const end = Math.max(anchor.offset, focus.offset);

        if (isSelectionInSameBlock && cursorBlock && cursorBlock.isContent()) {
            cursorBlock.setCursor(begin, end, true);
            return;
        }

        // When the tree was rebuilt wholesale (rebuildContents), the saved
        // selection's cached `anchorBlock` / `focusBlock` reference DETACHED
        // nodes from the previous tree — resolving them would set the native DOM
        // range onto a detached node and crash the next `getSelection()` read.
        // Re-resolve the caret from the (cloned) path against the fresh tree;
        // fall back to focusing the first content block when the saved path no
        // longer points at a content leaf (e.g. a paragraph became a table).
        if (treeRebuilt) {
            if (cursorBlock && cursorBlock.isContent())
                cursorBlock.setCursor(begin, end, true);
            else
                this.focus();

            return;
        }

        // Incremental (updateContents) path: blocks are still attached. Clone the
        // paths so `_setCursor`'s `queryBlock(path)` fallback can't drain the
        // caller's arrays — notably the selection object stored in the undo stack.
        this.selection.setSelection({
            ...selection,
            anchorPath: [...selection.anchorPath],
            focusPath: [...selection.focusPath],
        });
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
    rebuildContents(operations: JSONOp, selection: Nullable<IHistorySelection>, source: string) {
        this.jsonState.dispatch(operations, source);

        const state = this.jsonState.getState();
        this.scrollPage!.updateState(state);

        // The tree was rebuilt wholesale, so the selection's cached block
        // references are stale — resolve the caret from paths instead.
        this._restoreSelection(selection, true);
    }

    setContent(content: TState[] | string, autoFocus = false) {
        this.jsonState.setContent(content);
        const state = this.jsonState.getState();

        this.scrollPage!.updateState(state);
        this.history.clear();

        if (autoFocus)
            this.focus();
    }
}
