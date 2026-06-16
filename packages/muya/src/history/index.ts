import type { JSONOpList } from 'ot-json1';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, IHistorySelection } from '../selection/types';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import * as json1 from 'ot-json1';
import { asDoc } from '../state';
import { deepClone } from '../utils';

interface IOptions {
    delay: number;
    maxStack: number;
    userOnly: boolean;
}

interface IOperation {
    operation: JSONOpList;
    selection: Nullable<IHistorySelection>;
    // A `rebuild` entry is applied on undo/redo by dispatching its op to the
    // authoritative json state and rebuilding the live block tree wholesale
    // (ScrollPage.updateState) — NOT through `Editor.updateContents`'
    // incremental pick/drop DOM walker. The walker only handles a few op shapes
    // (single block insert at an index, text edit, checked/meta) and desyncs the
    // DOM from the json state for whole-document ops, so bulk replacements
    // (e.g. exiting source-code mode) are recorded as rebuild entries. The op
    // itself is a normal, fully-invertible ot-json1 op, so compose / transform /
    // invert continue to work unchanged.
    rebuild?: boolean;
}

interface IStack {
    undo: IOperation[];
    redo: IOperation[];
}

// A JSON-serializable view of an ISelection. The live endpoint `block`
// references are dropped — they are an in-memory optimization only.
// `Selection._setCursor` re-resolves the target block from each endpoint's
// `path` via `scrollPage.queryBlock(path)` when no block instance is present,
// so a path-only selection restores the caret losslessly.
type ISerializableAnchorFocusInfo = Pick<IAnchorFocusInfo, 'offset' | 'path'>;

interface ISerializableSelection {
    anchor: ISerializableAnchorFocusInfo;
    focus: ISerializableAnchorFocusInfo;
    isCollapsed: IHistorySelection['isCollapsed'];
    isSelectionInSameBlock: IHistorySelection['isSelectionInSameBlock'];
    direction: IHistorySelection['direction'];
    type: IHistorySelection['type'];
}

interface ISerializableOperation {
    operation: JSONOpList;
    selection: Nullable<ISerializableSelection>;
    rebuild?: boolean;
}

// The public, JSON-serializable shape returned by `getHistory` and accepted by
// `setHistory`. Mirrors the private `_stack` plus the bookkeeping pointers
// (`lastRecorded`, `selectionStack`) needed to round-trip the recording state.
export interface ISerializedHistory {
    stack: {
        undo: ISerializableOperation[];
        redo: ISerializableOperation[];
    };
    lastRecorded: number;
    selectionStack: (Nullable<ISerializableSelection>)[];
}

enum HistoryAction {
    UNDO = 'undo',
    REDO = 'redo',
}

const DEFAULT_OPTIONS = {
    delay: 1000,
    maxStack: 100,
    userOnly: false,
};

class History {
    private _lastRecorded: number = 0;
    private _ignoreChange: boolean = false;
    private _selectionStack: (Nullable<IHistorySelection>)[] = [];
    private _stack: IStack = {
        undo: [],
        redo: [],
    };

    get selection() {
        return this.muya.editor.selection;
    }

    constructor(public muya: Muya, private _options: IOptions = DEFAULT_OPTIONS) {
        this._listen();
    }

    private _listen() {
        this.muya.eventCenter.on(
            'json-change',
            ({
                op,
                source,
                prevDoc,
            }: {
                op: JSONOpList;
                source: string;
                prevDoc: TState[];
                doc: TState[];
            }) => {
                if (this._ignoreChange)
                    return;

                if (!this._options.userOnly || source === 'user')
                    this._record(op, prevDoc);
                else
                    this.transform(op);
            },
        );
    }

    private _change(source: HistoryAction, dest: HistoryAction) {
        if (this._stack[source].length === 0)
            return;

        const { operation, selection, rebuild } = this._stack[source].pop()!;
        const inverseOperation = json1.type.invert(operation);

        this._stack[dest].push({
            operation: inverseOperation as JSONOpList,
            selection: this.selection.getSelection(),
            rebuild,
        });

        this._lastRecorded = 0;
        this._ignoreChange = true;
        if (rebuild)
            this.muya.editor.rebuildContents(operation, selection, 'user');
        else
            this.muya.editor.updateContents(operation, selection, 'user');
        this._ignoreChange = false;

        this.getLastSelection();
    }

    clear() {
        this._stack = { undo: [], redo: [] };
        this._selectionStack = [];
        this._lastRecorded = 0;
    }

    /**
     * Return a deep, JSON-serializable snapshot of the undo/redo history.
     *
     * The ot-json1 ops are plain JSON arrays and are deep-cloned as-is.
     * Selections drop their live `anchorBlock` / `focusBlock` references and
     * keep only the serializable `anchorPath` / `focusPath` + offsets; the
     * caret is re-resolved from those paths on restore (see
     * `_toSerializableSelection`). The result can be `JSON.stringify`-d, stored
     * on a desktop tab, and handed back to `setHistory` to restore the exact
     * undo/redo state — `setHistory(getHistory())` followed by `undo()`
     * reproduces the prior document state.
     */
    getHistory(): ISerializedHistory {
        return {
            stack: {
                undo: this._stack.undo.map(op => this._toSerializableOperation(op)),
                redo: this._stack.redo.map(op => this._toSerializableOperation(op)),
            },
            lastRecorded: this._lastRecorded,
            selectionStack: this._selectionStack.map(sel =>
                this._toSerializableSelection(sel),
            ),
        };
    }

    /**
     * Restore a snapshot previously produced by `getHistory`. Replaces the
     * undo/redo stacks and recording bookkeeping. The restored selections are
     * path-only; `Selection.setSelection` / `_setCursor` resolve the live
     * block from the path when the op is later applied by `undo` / `redo`.
     */
    setHistory(history: ISerializedHistory) {
        this._stack = {
            undo: history.stack.undo.map(op => this._fromSerializableOperation(op)),
            redo: history.stack.redo.map(op => this._fromSerializableOperation(op)),
        };
        this._lastRecorded = history.lastRecorded ?? 0;
        this._selectionStack = (history.selectionStack ?? []).map(sel =>
            this._fromSerializableSelection(sel),
        );
    }

    private _toSerializableOperation(op: IOperation): ISerializableOperation {
        return {
            operation: deepClone(op.operation),
            selection: this._toSerializableSelection(op.selection),
            ...(op.rebuild ? { rebuild: true } : {}),
        };
    }

    private _fromSerializableOperation(op: ISerializableOperation): IOperation {
        return {
            operation: deepClone(op.operation),
            selection: this._fromSerializableSelection(op.selection),
            ...(op.rebuild ? { rebuild: true } : {}),
        };
    }

    // Strip the live block references and keep only plain paths + offsets.
    private _toSerializableSelection(
        selection: Nullable<IHistorySelection>,
    ): Nullable<ISerializableSelection> {
        if (selection == null)
            return selection;

        return {
            anchor: { offset: selection.anchor.offset, path: deepClone(selection.anchor.path) },
            focus: { offset: selection.focus.offset, path: deepClone(selection.focus.path) },
            isCollapsed: selection.isCollapsed,
            isSelectionInSameBlock: selection.isSelectionInSameBlock,
            direction: selection.direction,
            type: selection.type,
        };
    }

    // Rebuild a selection without live block references. The block instances
    // are intentionally omitted: the only consumers of a restored selection
    // are `editor.updateContents` and `selection._setCursor`, both of which
    // re-resolve the target block from each endpoint's `path` via
    // `scrollPage.queryBlock` when no block instance is present. The return
    // type is `IHistorySelection`, whose endpoint `block` references are
    // optional, so the missing block fields are part of the contract rather
    // than an unsound cast over fabricated `ContentBlock` instances.
    private _fromSerializableSelection(
        selection: Nullable<ISerializableSelection>,
    ): Nullable<IHistorySelection> {
        if (selection == null)
            return selection;

        return {
            anchor: { offset: selection.anchor.offset, path: deepClone(selection.anchor.path) },
            focus: { offset: selection.focus.offset, path: deepClone(selection.focus.path) },
            isCollapsed: selection.isCollapsed,
            isSelectionInSameBlock: selection.isSelectionInSameBlock,
            direction: selection.direction,
            type: selection.type,
        };
    }

    cutoff() {
        this._lastRecorded = 0;
    }

    getLastSelection() {
        this._selectionStack.push(this.selection.getSelection());

        if (this._selectionStack.length > 2)
            this._selectionStack.shift();

        return this._selectionStack.length === 2 ? this._selectionStack[0] : null;
    }

    private _record(op: JSONOpList, doc: TState[]) {
        if (op.length === 0)
            return;

        let selection = this.getLastSelection();
        this._stack.redo = [];
        let undoOperation = json1.type.invertWithDoc(op, asDoc(doc));

        const timestamp = Date.now();
        if (
            this._lastRecorded + this._options.delay > timestamp
            && this._stack.undo.length > 0
        ) {
            const { operation: lastOperation, selection: lastSelection }
                = this._stack.undo.pop()!;
            selection = lastSelection;
            undoOperation = json1.type.compose(undoOperation, lastOperation);
        }
        else {
            this._lastRecorded = timestamp;
        }

        if (!undoOperation || undoOperation.length === 0)
            return;

        this._stack.undo.push({ operation: undoOperation, selection });

        if (this._stack.undo.length > this._options.maxStack)
            this._stack.undo.shift();
    }

    /**
     * Record a whole-document replacement (e.g. exiting source-code mode) as a
     * single, standalone undo boundary that is applied via a full block-tree
     * rebuild rather than the incremental DOM walker.
     *
     * The forward op (`prevDoc` -> current state) is dispatched to the json
     * state by the caller; here we only record its lossless inverse so the first
     * undo reverts the entire bulk change in one step. The entry never coalesces
     * with neighbouring edits: `_lastRecorded` is reset so the next ordinary
     * edit also starts its own boundary, and the redo stack is cleared.
     */
    recordRebuild(op: JSONOpList, prevDoc: TState[], selection: Nullable<IHistorySelection>) {
        if (op.length === 0)
            return;

        const undoOperation = json1.type.invertWithDoc(op, asDoc(prevDoc));

        if (!undoOperation || undoOperation.length === 0)
            return;

        this._stack.redo = [];
        this._stack.undo.push({ operation: undoOperation, selection, rebuild: true });
        // Force the next ordinary edit into its own undo entry — the bulk
        // replacement must not absorb a later keystroke (or vice versa).
        this._lastRecorded = 0;

        if (this._stack.undo.length > this._options.maxStack)
            this._stack.undo.shift();
    }

    /**
     * Run `fn` (which dispatches a json-change) WITHOUT recording it on the undo
     * stack. The caller has already recorded the corresponding boundary itself
     * (see `recordRebuild`), so the forward apply must not be double-recorded.
     */
    suppressRecording(fn: () => void) {
        const previous = this._ignoreChange;
        this._ignoreChange = true;
        try {
            fn();
        }
        finally {
            this._ignoreChange = previous;
        }
    }

    canRedo() {
        return this._stack.redo.length > 0;
    }

    redo() {
        this._change(HistoryAction.REDO, HistoryAction.UNDO);
    }

    transform(op: JSONOpList) {
        transformStack(this._stack.undo, op);
        transformStack(this._stack.redo, op);
    }

    canUndo() {
        return this._stack.undo.length > 0;
    }

    undo() {
        this._change(HistoryAction.UNDO, HistoryAction.REDO);
    }
}

function transformStack(stack: IOperation[], operation: JSONOpList) {
    let remoteOperation = operation;

    for (let i = stack.length - 1; i >= 0; i -= 1) {
        const { operation: oldOperation } = stack[i];
        // TODO: need test.
        stack[i] = Object.assign(stack[i], {
            operation: json1.type.transform(oldOperation, remoteOperation, 'left'),
        });
        remoteOperation = json1.type.transform(
            remoteOperation,
            oldOperation,
            'right',
        )!;
        if (stack[i].operation.length === 0)
            stack.splice(i, 1);
    }
}

export default History;
