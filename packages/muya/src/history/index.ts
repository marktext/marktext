import type { JSONOpList } from 'ot-json1';
import type { Muya } from '../muya';
import type { IAnchorFocusInfo, IHistorySelection } from '../selection/types';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import * as json1 from 'ot-json1';
import { asDoc } from '../state';
import { ChangeSource } from '../types';
import { deepClone } from '../utils';

interface IOptions {
    delay: number;
    maxStack: number;
    userOnly: boolean;
}

interface IOperation {
    operation: JSONOpList;
    selection: Nullable<IHistorySelection>;
    // Whole-document operations require a full tree rebuild; the incremental walker cannot apply them safely.
    rebuild?: boolean;
}

interface IStack {
    undo: IOperation[];
    redo: IOperation[];
}

// Persist paths and offsets; live block references cannot survive serialization.
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
    private _ignoreChange: boolean = false;
    private _selectionStack: (Nullable<IHistorySelection>)[] = [];
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
            ({
                op,
                source,
                prevDoc,
            }: {
                op: Nullable<JSONOpList>;
                source: ChangeSource;
                prevDoc: TState[];
                doc: TState[];
            }) => {
                if (this._ignoreChange)
                    return;

                // IME edits can compose to the identity operation, leaving nothing to record (#4806).
                if (op == null)
                    return;

                if (!this._options.userOnly || source === ChangeSource.User)
                    this._record(op, prevDoc);
                else
                    this._transform(op);
            },
        );
    }

    private _change(source: HistoryAction, dest: HistoryAction) {
        if (this._stack[source].length === 0)
            return;

        const { operation, selection, rebuild } = this._stack[source].pop()!;
        const inverseOperation = json1.type.invertWithDoc(
            operation,
            asDoc(this._muya.editor.jsonState.getState()),
        );

        this._stack[dest].push({
            operation: inverseOperation as JSONOpList,
            selection: this._selection.getSelection(),
            rebuild,
        });

        this._lastRecorded = 0;
        this._ignoreChange = true;
        try {
            if (rebuild)
                this._muya.editor.rebuildContents(operation, selection, ChangeSource.User);
            else
                this._muya.editor.updateContents(operation, selection, ChangeSource.User);
        }
        finally {
            this._ignoreChange = false;
        }

        this._getLastSelection();
    }

    clear() {
        this._stack = { undo: [], redo: [] };
        this._selectionStack = [];
        this._lastRecorded = 0;
        this._ignoreChange = false;
    }

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

    // Restored selections omit live blocks; editor selection restoration resolves their paths.
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

    // An explicit selection becomes the undo destination for the next recorded edit.
    cutoff(selection?: IHistorySelection) {
        this._lastRecorded = 0;
        if (selection)
            this._selectionStack = [selection];
    }

    markInputBoundary(inputType: string, data: Nullable<string>): void {
        const kind = classifyInputKind(inputType);
        if (kind == null)
            return;
        if (shouldBreakUndoGroup(this._lastInputKind, kind, data))
            this.cutoff();
        this._lastInputKind = kind;
    }

    private _getLastSelection() {
        this._selectionStack.push(this._selection.getSelection());

        if (this._selectionStack.length > 2)
            this._selectionStack.shift();

        return this._selectionStack.length === 2 ? this._selectionStack[0] : null;
    }

    private _record(op: JSONOpList, doc: TState[]) {
        if (op.length === 0)
            return;

        let selection = this._getLastSelection();
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
    recordRebuild(op: JSONOpList, prevDoc: TState[], selection: Nullable<IHistorySelection>) {
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

    // Apply an already-recorded change without adding a duplicate undo entry.
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
