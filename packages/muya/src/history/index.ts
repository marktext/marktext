import type { JSONOpList } from 'ot-json1';
import type { Muya } from '../muya';
import type { IHistorySelection } from '../selection/types';
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
}

interface IStack {
    undo: IOperation[];
    redo: IOperation[];
}

// A JSON-serializable view of an ISelection. The live `anchorBlock` /
// `focusBlock` references are dropped — they are an in-memory optimization
// only. `Selection._setCursor` re-resolves the target block from
// `anchorPath` / `focusPath` via `scrollPage.queryBlock(path)` when no block
// instance is present, so a path-only selection restores the caret losslessly.
interface ISerializableSelection {
    anchor: IHistorySelection['anchor'];
    focus: IHistorySelection['focus'];
    anchorPath: IHistorySelection['anchorPath'];
    focusPath: IHistorySelection['focusPath'];
    isCollapsed: IHistorySelection['isCollapsed'];
    isSelectionInSameBlock: IHistorySelection['isSelectionInSameBlock'];
    direction: IHistorySelection['direction'];
    type: IHistorySelection['type'];
}

interface ISerializableOperation {
    operation: JSONOpList;
    selection: Nullable<ISerializableSelection>;
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

    constructor(public muya: Muya, private options: IOptions = DEFAULT_OPTIONS) {
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

                if (!this.options.userOnly || source === 'user')
                    this._record(op, prevDoc);
                else
                    this.transform(op);
            },
        );
    }

    private _change(source: HistoryAction, dest: HistoryAction) {
        if (this._stack[source].length === 0)
            return;

        const { operation, selection } = this._stack[source].pop()!;
        const inverseOperation = json1.type.invert(operation);

        this._stack[dest].push({
            operation: inverseOperation as JSONOpList,
            selection: this.selection.getSelection(),
        });

        this._lastRecorded = 0;
        this._ignoreChange = true;
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
        };
    }

    private _fromSerializableOperation(op: ISerializableOperation): IOperation {
        return {
            operation: deepClone(op.operation),
            selection: this._fromSerializableSelection(op.selection),
        };
    }

    // Strip the live block references and keep only plain paths + offsets.
    private _toSerializableSelection(
        selection: Nullable<IHistorySelection>,
    ): Nullable<ISerializableSelection> {
        if (selection == null)
            return selection;

        return {
            anchor: deepClone(selection.anchor),
            focus: deepClone(selection.focus),
            anchorPath: deepClone(selection.anchorPath),
            focusPath: deepClone(selection.focusPath),
            isCollapsed: selection.isCollapsed,
            isSelectionInSameBlock: selection.isSelectionInSameBlock,
            direction: selection.direction,
            type: selection.type,
        };
    }

    // Rebuild a selection without live block references. The block instances
    // are intentionally omitted: the only consumers of a restored selection
    // are `editor.updateContents` and `selection._setCursor`, both of which
    // re-resolve the target block from `anchorPath` / `focusPath` via
    // `scrollPage.queryBlock` when no block instance is present. The return
    // type is `IHistorySelection`, whose `anchorBlock` / `focusBlock` are
    // optional, so the missing block fields are part of the contract rather
    // than an unsound cast over fabricated `ContentBlock` instances.
    private _fromSerializableSelection(
        selection: Nullable<ISerializableSelection>,
    ): Nullable<IHistorySelection> {
        if (selection == null)
            return selection;

        return {
            anchor: deepClone(selection.anchor),
            focus: deepClone(selection.focus),
            anchorPath: deepClone(selection.anchorPath),
            focusPath: deepClone(selection.focusPath),
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
            this._lastRecorded + this.options.delay > timestamp
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

        if (this._stack.undo.length > this.options.maxStack)
            this._stack.undo.shift();
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
