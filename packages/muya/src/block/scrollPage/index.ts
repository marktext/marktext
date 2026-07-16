import type { JSONOpList } from 'ot-json1';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import type { Nullable } from '../../types';
import type Content from '../base/content';
import type TreeNode from '../base/treeNode';
import type { IConstructor, TBlockPath } from '../types';
import { BLOCK_DOM_PROPERTY } from '../../config';
import { cloneStateTree } from '../../state/cloneState';
import { isHTMLElement, isMouseEvent } from '../../utils';
import logger from '../../utils/logger';
import Parent from '../base/parent';

const debug = logger('scrollpage:');

interface IBlurFocus {
    blur: Nullable<Content>;
    focus: Nullable<Content>;
}

// Recursive node count of a state subtree — the unit of mount budgeting.
function stateWeight(state: TState): number {
    let weight = 1;
    if ('children' in state && Array.isArray(state.children)) {
        for (const child of state.children as TState[])
            weight += stateWeight(child);
    }
    return weight;
}

// End index (exclusive) after taking blocks from `from` until `budget`
// weight is consumed. Always takes at least one block so progress is made
// even when a single block exceeds the whole budget.
function takeByWeight(state: TState[], from: number, budget: number): number {
    let end = from;
    let used = 0;
    while (end < state.length) {
        used += stateWeight(state[end]);
        end += 1;
        if (used >= budget)
            break;
    }
    return end;
}

export class ScrollPage extends Parent {
    private _blurFocus: IBlurFocus = { blur: null, focus: null };

    static override blockName = 'scrollpage';

    // Registry of block constructors keyed by their static blockName.
    // Stored as Parent constructors — the overwhelming majority of
    // call sites do `loadBlock(...).create(...).append(child)`, which only
    // makes sense for Parent. Content leaves register themselves through
    // their containing Parent's create flow and don't go through
    // `loadBlock(...).create()` externally.
    private static _registeredBlocks = new Map<string, IConstructor<Parent>>();

    static register(Block: IConstructor<TreeNode>) {
        const { blockName } = Block;
        this._registeredBlocks.set(blockName, Block as IConstructor<Parent>);
    }

    // Returns the registered constructor. Asserts non-undefined for
    // callers (the registry is populated by `registerBlocks()` once at
    // `editor.init()` time, and `loadBlock` runs strictly after init.).
    // Mismatched names hit the warn branch and the caller crashes at
    // `.create()` — matches the original loose contract.
    static loadBlock(blockName: string): IConstructor<Parent> {
        const block = this._registeredBlocks.get(blockName);

        if (!block)
            debug.warn(`block:${blockName} is not existed.`);

        return block as IConstructor<Parent>;
    }

    static create(muya: Muya, state: TState[]) {
        const scrollPage = new ScrollPage(muya);

        scrollPage._mountBlocks(state);

        scrollPage.parent!.domNode!.appendChild(scrollPage.domNode!);

        return scrollPage;
    }

    // Chunked-mount tuning. The synchronous prefix is budgeted in STATE
    // WEIGHT (the recursive node count of a top-level block, not block
    // count — one list with thousands of items would blow a count budget)
    // and comfortably overfills any viewport. Background chunks are budgeted
    // by ELAPSED TIME so a scheduled task stays under half a frame on the
    // machine actually running it. A single top-level block larger than
    // either budget still mounts as one unit — blocks are atomic — which is
    // the documented bound of this scheme.
    // The chunk budget bounds the JS append work only — the browser still
    // styles/lays out each appended chunk after the task, so the observed
    // event-loop gap is larger than the budget. 4 ms keeps that total gap
    // small on typical content; the perf smoke guards it end to end.
    private static readonly _initialMountWeight = 512;
    private static readonly _chunkBudgetMs = 4;

    private _pendingMount: {
        handle: ReturnType<typeof setTimeout> | null;
    } | null = null;

    // See suspendOnDemandMount().
    private _onDemandMountSuspended = false;

    override get path() {
        return [];
    }

    constructor(muya: Muya) {
        super(muya);
        // muya is not extends Parent, but it is the parent of scrollPage.
        // ScrollPage is the tree root; widening the base `TreeNode.parent`
        // declaration would ripple to every node, so spell out the boundary.
        // eslint-disable-next-line no-restricted-syntax
        this.parent = muya as unknown as Parent;
        this.tagName = 'div';
        this.classList = ['mu-container'];

        this.createDomNode();
        this._listenDomEvent();
    }

    override getState() {
        debug.warn('You can never call `getState` in scrollPage');

        return {} as TState;
    }

    private _listenDomEvent() {
        const { eventCenter } = this.muya;
        const { domNode } = this;

        eventCenter.attachDOMEvent(domNode!, 'click', this._clickHandler.bind(this));
    }

    updateState(state: TState[]) {
        this.cancelPendingMount();
        // Empty scrollPage dom
        this.empty();
        this._mountBlocks(state);
    }

    // Building every block's DOM subtree up front is the dominant open cost on
    // large documents (#4887): parse and state are linear, but a 300k-word file
    // still means ~100k block nodes constructed in one synchronous task. Mount
    // an over-viewport prefix synchronously and append the rest in scheduled
    // time-budgeted chunks, so the document is visible and editable at once.
    //
    // The pending tail is NOT a snapshot. Every chunk re-reads
    // `jsonState.rawState` and resumes at the live child count; the invariant
    // is that the mounted prefix always equals `state[0 .. children.length)`.
    // Structural edits (Enter splits, paste, block removal) mutate the live
    // tree and the state at the SAME index, so the invariant survives them
    // with no flushing. Whole-tree consumers (`queryBlock` into the tail,
    // `lastContentInDescendant`, search) mount what they need through
    // `ensureMountedThrough` / `flushPendingMount`.
    private _mountBlocks(state: TState[]) {
        const initial = takeByWeight(state, 0, ScrollPage._initialMountWeight);
        this._appendFromState(state, 0, initial);

        if (state.length > initial) {
            this._pendingMount = { handle: null };
            this._scheduleNextChunk();
        }
    }

    private _appendFromState(state: readonly TState[], from: number, to: number) {
        // Blocks keep references into the state object they are built from
        // (`this.meta = state.meta` and the like). The slice may come straight
        // from `jsonState.rawState`, so clone it — a block mutating shared
        // metadata would silently rewrite the JSON state ahead of its op.
        this.append(
            ...cloneStateTree(state.slice(from, to)).map((block) => {
                return ScrollPage.loadBlock(block.name).create(this.muya, block);
            }),
        );
    }

    private _scheduleNextChunk() {
        if (!this._pendingMount)
            return;

        // setTimeout keeps mounting while the tab is backgrounded (rAF stalls).
        this._pendingMount.handle = setTimeout(() => {
            this._mountNextChunk();
        }, 0);
    }

    private _mountNextChunk() {
        const pending = this._pendingMount;
        if (!pending)
            return;

        // Edits mutate the live tree immediately but their ops reach the
        // state on the next frame; drain them first so the live child count
        // is a valid cursor into `rawState`.
        this.muya.editor.jsonState.flush();

        // Mount block by block until the task budget is spent — actual
        // elapsed time, not a fixed weight, so one chunk never grows into a
        // frame-blowing task on heavy content.
        const states = this.muya.editor.jsonState.rawState;
        const started = performance.now();
        let next = this.children.length;
        while (
            next < states.length
            && performance.now() - started < ScrollPage._chunkBudgetMs
        ) {
            this._appendFromState(states, next, next + 1);
            next += 1;
        }

        if (next >= states.length) {
            this._pendingMount = null;
            this.muya.eventCenter.emit('muya-mount-complete', { total: states.length });
        }
        else {
            this.muya.eventCenter.emit('muya-mount-progress', {
                mounted: next,
                total: states.length,
            });
            this._scheduleNextChunk();
        }
    }

    /**
     * Mount every top-level block an ot-json1 operation touches. MUST run
     * against the pre-dispatch state: applying the op to the state first and
     * mounting afterwards would materialize the target from the updated
     * state and then apply the op to it a second time.
     */
    ensureMountedForOperation(op: JSONOpList) {
        if (!this._pendingMount)
            return;

        // Collect the leading numeric descent of every path in the op —
        // the top-level block indices. Deeper numbers (child indices, text
        // offsets) are never the FIRST element of a component, and branch
        // lists nest their sub-paths as arrays.
        let max = -1;
        const scan = (component: unknown) => {
            if (!Array.isArray(component) || component.length === 0)
                return;
            const first: unknown = component[0];
            if (typeof first === 'number') {
                if (first > max)
                    max = first;
            }
            else if (Array.isArray(first)) {
                for (const child of component)
                    scan(child);
            }
        };
        scan(op);

        // Mount one PAST the deepest touched index: a replace picks the
        // target out of the live tree and then drops the replacement before
        // the next sibling — that reference sibling must already be mounted,
        // or the drop would materialize it from the post-dispatch state.
        if (max >= 0)
            this.ensureMountedThrough(max + 1);
    }

    /**
     * While the incremental pick/drop walker applies an operation, on-demand
     * materialization must stay OFF: the state is already post-dispatch, so
     * mounting during the walk would materialize nodes the walker itself is
     * about to insert (duplicating them). Targets are pre-mounted from the
     * pre-dispatch state instead (`ensureMountedForOperation`); if the
     * walker still reaches an unmounted path it fails loudly and the
     * caller's fallback rebuilds the whole tree.
     */
    suspendOnDemandMount() {
        this._onDemandMountSuspended = true;
    }

    resumeOnDemandMount() {
        this._onDemandMountSuspended = false;
    }

    /**
     * Synchronously mount blocks until the top-level index is available.
     * Bounded consumers (offset-based cursor restore, path queries into the
     * tail, TOC click-to-scroll) use this instead of a full flush.
     */
    ensureMountedThrough(index: number) {
        const pending = this._pendingMount;
        if (!pending || index < this.children.length)
            return;

        // See _mountNextChunk: pending edit ops must land in the state
        // before the live child count is used as a cursor into it.
        this.muya.editor.jsonState.flush();

        const states = this.muya.editor.jsonState.rawState;
        if (index >= states.length - 1) {
            this.flushPendingMount();
            return;
        }

        if (pending.handle !== null) {
            clearTimeout(pending.handle);
            pending.handle = null;
        }
        this._appendFromState(states, this.children.length, index + 1);
        this.muya.eventCenter.emit('muya-mount-progress', {
            mounted: this.children.length,
            total: states.length,
        });
        this._scheduleNextChunk();
    }

    override lastContentInDescendant() {
        // End-of-document consumers (Ctrl+End, select-all, cursor restore)
        // must see the real last block, not the last mounted chunk.
        this.flushPendingMount();

        return super.lastContentInDescendant();
    }

    /** Synchronously finish a chunked mount that is still in flight. */
    flushPendingMount() {
        const pending = this._pendingMount;
        if (!pending)
            return;

        if (pending.handle !== null)
            clearTimeout(pending.handle);
        this._pendingMount = null;

        // See _mountNextChunk: pending edit ops must land in the state
        // before the live child count is used as a cursor into it.
        this.muya.editor.jsonState.flush();

        const states = this.muya.editor.jsonState.rawState;
        this._appendFromState(states, this.children.length, states.length);
        this.muya.eventCenter.emit('muya-mount-complete', {
            total: states.length,
        });
    }

    /**
     * Drop a mount that is still in flight without materializing it. Called
     * by `updateState` before a rebuild and by `Muya.destroy` — the pending
     * timer must never run against a torn-down instance. An explicit call is
     * the lifecycle signal; DOM connectedness is deliberately not consulted,
     * so detached hosts keep mounting (`new Muya(detachedElement)` works).
     */
    cancelPendingMount() {
        if (!this._pendingMount)
            return;
        if (this._pendingMount.handle !== null)
            clearTimeout(this._pendingMount.handle);
        this._pendingMount = null;
    }

    /**
     * Find the content block by the path
     * @param {Array} path
     */
    queryBlock(path: TBlockPath) {
        if (path.length === 0)
            return this;

        // An op or lookup may target a block whose chunk has not mounted yet —
        // mount up to the target only, never the whole remainder (a full
        // flush here would turn the source-mode cursor handoff back into a
        // whole-document mount). Suspended while the pick/drop walker runs:
        // see suspendOnDemandMount().
        if (
            this._pendingMount
            && !this._onDemandMountSuspended
            && (path[0] as number) >= this.children.length
        ) {
            this.ensureMountedThrough(path[0] as number);
        }

        const p = path.shift() as number;
        const block = this.find(p) as Parent & { queryBlock: (p: TBlockPath) => Parent | Content | undefined };
        return block && path.length ? block.queryBlock(path) : block;
    }

    updateRefLinkAndImage(label: string) {
        const REG = new RegExp(`\\[${label}\\](?!:)`);

        this.breadthFirstTraverse((node) => {
            if (node.isContent() && REG.test(node.text))
                node.update();
        });
    }

    handleBlurFromContent(block: Content) {
        this._blurFocus.blur = block;
        requestAnimationFrame(this._updateActiveStatus);
    }

    handleFocusFromContent(block: Content) {
        this._blurFocus.focus = block;
        requestAnimationFrame(this._updateActiveStatus);
    }

    private _updateActiveStatus = () => {
        const { blur, focus } = this._blurFocus;

        if (blur == null && focus == null)
            return;

        let needBlurBlocks: Parent[] = [];
        let needFocusBlocks: Parent[] = [];
        let block;

        if (blur && focus) {
            needFocusBlocks = focus.getAncestors();
            block = blur.parent;
            while (block && block.isParent && block.isParent() && !needFocusBlocks.includes(block)) {
                needBlurBlocks.push(block);
                block = block.parent;
            }
        }
        else if (blur) {
            needBlurBlocks = blur.getAncestors();
        }
        else if (focus) {
            needFocusBlocks = focus.getAncestors();
        }

        if (needBlurBlocks.length) {
            needBlurBlocks.forEach((b) => {
                b.active = false;
            });
        }

        if (needFocusBlocks.length) {
            needFocusBlocks.forEach((b) => {
                b.active = true;
            });
        }

        this._blurFocus = {
            blur: null,
            focus: null,
        };
    };

    // Create a new paragraph if click the blank area in editor.
    private _clickHandler(event: Event) {
        if (!isMouseEvent(event) || !isHTMLElement(event.target))
            return;

        const target = event.target;

        if (target[BLOCK_DOM_PROPERTY] === this) {
            // While a tail is pending, the area below the mount frontier is
            // NOT blank — the document logically continues there (#4887).
            // Appending would land mid-document; materializing the tail on a
            // container click would freeze a large file for taps in the
            // gutter or between blocks, and the forced reflow then moves the
            // real bottom below the click point anyway. Do nothing —
            // background chunks finish shortly and end-of-document clicks
            // behave normally again.
            if (this._pendingMount)
                return;

            const lastChild = this.lastChild as Parent;
            const lastContentBlock = lastChild.lastContentInDescendant()!;
            const { clientY } = event;
            const lastChildDom = lastChild.domNode;
            const { bottom } = lastChildDom!.getBoundingClientRect();

            if (clientY > bottom) {
                if (
                    lastChild.blockName === 'paragraph'
                    && lastContentBlock.text === ''
                ) {
                    lastContentBlock.setCursor(0, 0);
                }
                else {
                    const state = {
                        name: 'paragraph',
                        text: '',
                    };
                    const newNode = ScrollPage.loadBlock(state.name).create(
                        this.muya,
                        state,
                    );
                    this.append(newNode, 'user');
                    const cursorBlock = newNode.lastContentInDescendant();
                    cursorBlock.setCursor(0, 0, true);
                }
            }
        }
    }
}
