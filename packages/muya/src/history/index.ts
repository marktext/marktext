import type { JSONOpList } from 'ot-json1';
import type { Muya } from '../muya';
import type { ISelection } from '../selection/types';
import type { TState } from '../state/types';
import type { Nullable } from '../types';
import * as json1 from 'ot-json1';
import { asDoc } from '../state';

interface IOptions {
    delay: number;
    maxStack: number;
    userOnly: boolean;
}

interface IOperation {
    operation: JSONOpList;
    selection: Nullable<ISelection>;
}

interface IStack {
    undo: IOperation[];
    redo: IOperation[];
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
    private _selectionStack: (Nullable<ISelection>)[] = [];
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
