import type { JSONOpList } from 'ot-json1';
import type { Muya } from '../muya';
import type { TSelectionState } from '../selection/types';
import type { IJSONChangePayload } from '../state/changePayload';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import * as json1 from 'ot-json1';
import { copySelectionState, equalSelections } from '../selection/state';
import { asDoc } from '../state';
import { getPreviousDoc, getRecordSelection, isHistorySuppressed } from '../state/changePayload';
import { ChangeSource } from '../types';
import { deepClone } from '../utils';

interface IOptions {
    delay: number;
    maxStack: number;
    userOnly: boolean;
}

interface IOperation {
    operation: JSONOpList;
    selection: Nullable<TSelectionState>;
    // Whole-document operations require a full tree rebuild; the incremental walker cannot apply them safely.
    rebuild?: boolean;
}

interface IStack {
    undo: IOperation[];
    redo: IOperation[];
}

interface ISerializableOperation {
    operation: JSONOpList;
    selection: Nullable<TSelectionState>;
    rebuild?: boolean;
}

export interface ISerializedHistory {
    stack: {
        undo: ISerializableOperation[];
        redo: ISerializableOperation[];
    };
    lastRecorded: number;
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

export type TInputKind = 'insert' | 'delete';

export function classifyInputKind(inputType: string): Nullable<TInputKind> {
    if (inputType.startsWith('insert'))
        return 'insert';
    if (inputType.startsWith('delete'))
        return 'delete';
    return null;
}

// Word boundaries and insert/delete switches split groups even within the time delay.
export function shouldBreakUndoGroup(
    prevKind: Nullable<TInputKind>,
    kind: Nullable<TInputKind>,
    data: Nullable<string>,
): boolean {
    if (kind == null)
        return false;
    const isWordBoundary = kind === 'insert' && data != null && /\s/.test(data);
    const switchedKind = prevKind != null && prevKind !== kind;
    return isWordBoundary || switchedKind;
}

class History {
    private _lastRecorded: number = 0;
    private _lastInputKind: Nullable<TInputKind> = null;
    private _nextSelection: Nullable<TSelectionState> | undefined;
    private _lastSelection: Nullable<TSelectionState> = null;
    private _stack: IStack = {
        undo: [],
        redo: [],
    };

    private get _selection() {
        return this._muya.editor.selection;
    }

    constructor(private _muya: Muya, private _options: IOptions = DEFAULT_OPTIONS) {
        this._listen();
    }

    private _listen() {
        this._muya.eventCenter.on(
            'json-change',
            (payload: IJSONChangePayload) => {
                const { op, source } = payload;
                if (isHistorySuppressed(payload))
                    return;

                // IME edits can compose to the identity operation, leaving nothing to record (#4806).
                if (op == null)
                    return;

                if (!this._options.userOnly || source === ChangeSource.User)
                    this._record(op, getPreviousDoc(payload), getRecordSelection(payload));
                else
                    this._transform(op);
            },
        );
    }

    private _change(source: HistoryAction, dest: HistoryAction) {
        this._muya.editor.transactions.assertStandalone();
        // Recording pending edits can clear redo; commit them before inspecting either stack.
        this._muya.editor.transactions.flush();

        if (this._stack[source].length === 0)
            return;

        const { operation, selection, rebuild } = this._stack[source].pop()!;
        const inverseOperation = json1.type.invertWithDoc(
            operation,
            asDoc(this._muya.editor.jsonState.getState()),
        );

        this._stack[dest].push({
            operation: inverseOperation as JSONOpList,
            selection: this._selection.getSelectionState(),
            rebuild,
        });

        this._lastRecorded = 0;
        this._muya.editor.replayContents(operation, selection, rebuild);

        this._lastSelection = this._selection.getSelectionState();
    }

    clear() {
        this._stack = { undo: [], redo: [] };
        this._nextSelection = undefined;
        this._lastSelection = null;
        this._lastRecorded = 0;
    }

    getHistory(): ISerializedHistory {
        return {
            stack: {
                undo: this._stack.undo.map(op => this._toSerializableOperation(op)),
                redo: this._stack.redo.map(op => this._toSerializableOperation(op)),
            },
            lastRecorded: this._lastRecorded,
        };
    }

    setHistory(history: ISerializedHistory) {
        this._stack = {
            undo: history.stack.undo.map(op => this._fromSerializableOperation(op)),
            redo: history.stack.redo.map(op => this._fromSerializableOperation(op)),
        };
        this._lastRecorded = history.lastRecorded ?? 0;
        this._nextSelection = undefined;
        this._lastSelection = null;
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

    private _toSerializableSelection(selection: Nullable<TSelectionState>): TSelectionState | null {
        return copySelectionState(selection ?? null);
    }

    private _fromSerializableSelection(selection: Nullable<TSelectionState>): TSelectionState | null {
        return copySelectionState(selection ?? null);
    }

    // An explicit selection becomes the undo destination for the next recorded edit.
    cutoff(selection?: TSelectionState) {
        this._lastRecorded = 0;
        if (selection)
            this._nextSelection = this._toSerializableSelection(selection);
    }

    markInputBoundary(inputType: string, data: Nullable<string>): void {
        const kind = classifyInputKind(inputType);
        if (kind == null)
            return;
        if (shouldBreakUndoGroup(this._lastInputKind, kind, data))
            this.cutoff();
        this._lastInputKind = kind;
    }

    private _record(op: JSONOpList, doc: readonly TState[], before: Nullable<TSelectionState>) {
        if (op.length === 0)
            return;

        let selection = this._nextSelection !== undefined ? this._nextSelection : before;
        this._nextSelection = undefined;
        if (!equalSelections(selection ?? null, this._lastSelection ?? null))
            this._lastRecorded = 0;
        this._lastSelection = this._selection.getSelectionState();
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

    // Record a whole-document replacement as a standalone undo step and clear redo.
    // The caller must apply the forward operation separately; later edits start a new group.
    recordRebuild(op: JSONOpList, prevDoc: readonly TState[], selection: Nullable<TSelectionState>) {
        if (op.length === 0)
            return;

        const undoOperation = json1.type.invertWithDoc(op, asDoc(prevDoc));

        if (!undoOperation || undoOperation.length === 0)
            return;

        this._stack.redo = [];
        this._stack.undo.push({ operation: undoOperation, selection, rebuild: true });
        this._lastRecorded = 0;

        if (this._stack.undo.length > this._options.maxStack)
            this._stack.undo.shift();
    }

    canRedo() {
        return this._stack.redo.length > 0;
    }

    redo() {
        if (!this._muya.canMutate)
            return;
        this._change(HistoryAction.REDO, HistoryAction.UNDO);
    }

    private _transform(op: JSONOpList) {
        transformStack(this._stack.undo, op);
        transformStack(this._stack.redo, op);
    }

    canUndo() {
        return this._stack.undo.length > 0;
    }

    undo() {
        if (!this._muya.canMutate)
            return;
        this._change(HistoryAction.UNDO, HistoryAction.REDO);
    }
}

function transformStack(stack: IOperation[], operation: JSONOpList) {
    let remoteOperation = operation;

    for (let i = stack.length - 1; i >= 0; i -= 1) {
        const { operation: oldOperation } = stack[i];
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
