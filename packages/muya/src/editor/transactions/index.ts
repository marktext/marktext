import type { Doc, JSONOp, Path } from 'ot-json1';
import type { TSelectionState } from '../../selection/types';
import type JSONState from '../../state';
import type { TState } from '../../state/types';
import type { IMuyaOptions, Nullable } from '../../types';
import type { TDiff } from '../../utils';
import * as json1 from 'ot-json1';
import { asDoc } from '../../state';
import { ChangeSource } from '../../types';
import { deepClone } from '../../utils';
import { listLoosenessOperations } from './listLooseness';

export interface ITransactionOptions {
    source?: ChangeSource;
    selection?: Nullable<TSelectionState>;
    view?: 'incremental' | 'rebuild';
    history?: 'merge' | 'isolated' | 'separate' | 'ignore';
    replay?: boolean;
    recordSelection?: Nullable<TSelectionState>;
}

export interface ICompletedTransaction extends Required<Omit<ITransactionOptions, 'recordSelection' | 'view'>> {
    view: 'incremental' | 'rebuild' | 'mutated';
    operation: JSONOp;
    blockOperation: JSONOp;
    recordSelection?: Nullable<TSelectionState>;
}

type TEditingRule = (before: readonly TState[], after: readonly TState[], operation: JSONOp, options: IMuyaOptions) => JSONOp;

const EDITING_RULES: TEditingRule[] = [listLoosenessOperations];

/**
 * Collect live Block mutations and complete editing rules before committing.
 * Explicit scopes nest; unscoped DOM mutations share the next frame. Replay
 * commits recorded operations verbatim, independent of current preferences.
 */
export class EditTransactions {
    private _pending: JSONOp = null;
    private _pendingSource: ChangeSource | undefined;
    private _candidate: readonly TState[] | null = null;
    private _pendingHistory: 'merge' | 'isolated' = 'merge';
    private _recordSelection: Nullable<TSelectionState> | undefined;
    private _rafId: number | null = null;
    private _depth = 0;
    private _failed = false;
    private _error: unknown;

    constructor(
        private _state: JSONState,
        private _options: () => IMuyaOptions,
        private _commit: (transaction: ICompletedTransaction) => void,
        private _rollback: () => void,
        private _applyPending: (operation: JSONOp, options: ITransactionOptions, preview: readonly TState[]) => void,
        private _getSelection: () => Nullable<TSelectionState> = () => null,
    ) {}

    /** Read-only document for rendering live edits before the scope commits. */
    get candidateState(): readonly TState[] {
        if (this._pending === null)
            return this._state.rawState;
        return this._candidate ??= this._state.preview(this._pending);
    }

    get isActive(): boolean {
        return this._depth > 0 || this._pending !== null;
    }

    captureSelection() {
        if (this._recordSelection === undefined)
            this._recordSelection = this._getSelection();
    }

    /** Synchronous Block commands form one commit, including nested commands. */
    run<T>(command: () => T, isolated = false, selection: Nullable<TSelectionState> = null): T {
        if (this._depth === 0) {
            this.flush();
            this._failed = false;
            this._recordSelection = selection;
        }
        if (isolated)
            this._pendingHistory = 'isolated';
        this._depth++;
        let result!: T;
        let failed = false;
        let failure: unknown;
        try {
            result = command();
        }
        catch (error) {
            this._failed = true;
            this._error = error;
            failed = true;
            failure = error;
        }
        finally {
            this._depth--;
        }
        if (this._depth === 0) {
            if (this._failed) {
                this.cancel();
                this._rollback();
                throw this._error;
            }
            this.flush();
        }
        if (failed)
            throw failure;
        return result;
    }

    enqueue(operation: JSONOp, source = ChangeSource.User) {
        if (operation === null)
            return;
        this.captureSelection();
        this._pending = json1.type.compose(this._pending, deepClone(operation));
        this._candidate = null;
        if (source === ChangeSource.User || this._pendingSource === undefined)
            this._pendingSource = source;
        if (this._depth || this._rafId !== null)
            return;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this.flush();
        });
    }

    insertOperation(path: Path, state: TState) {
        this.enqueue(json1.insertOp(path, asDoc(state)));
    }

    removeOperation(path: Path) {
        this.enqueue(json1.removeOp(path));
    }

    editOperation(path: Path, diff: TDiff[]) {
        this.enqueue(json1.editOp(path, 'text-unicode', diff));
    }

    replaceOperation(path: Path, before: Doc, after: Doc) {
        this.enqueue(json1.replaceOp(path, before, after));
    }

    insertValueOperation(path: Path, value: Doc) {
        this.enqueue(json1.insertOp(path, value));
    }

    /** Operations inside a scope join it; standalone operations flush earlier edits first. */
    apply(operation: JSONOp, options: ITransactionOptions = {}) {
        if (this._depth > 0 && !options.replay && (options.history ?? 'merge') === 'merge') {
            const next = this._state.preview(json1.type.compose(this._pending, operation));
            this.enqueue(operation, options.source);
            this._candidate = next;
            this._applyPending(deepClone(operation), options, next);
            return;
        }
        this.assertStandalone();
        this.flush();
        const transaction = this._complete(operation, {
            ...options,
            recordSelection: options.recordSelection !== undefined ? options.recordSelection : this._getSelection(),
        });
        this._commit(transaction);
    }

    // Clear before publishing so edits from listeners belong to the next batch.
    flush() {
        if (this._depth > 0)
            return;
        const operation = this._pending;
        const source = this._pendingSource;
        const history = this._pendingHistory;
        const recordSelection = this._recordSelection;
        this.cancel();
        if (operation === null)
            return;
        let transaction: ICompletedTransaction;
        try {
            transaction = this._complete(operation, { source, history, recordSelection }, true);
        }
        catch (error) {
            this._rollback();
            throw error;
        }
        this._commit(transaction);
    }

    /** Discard pending edits when replacing or destroying the document. */
    cancel() {
        if (this._rafId !== null)
            cancelAnimationFrame(this._rafId);
        this._rafId = null;
        this._pending = null;
        this._pendingSource = undefined;
        this._candidate = null;
        this._pendingHistory = 'merge';
        this._recordSelection = undefined;
    }

    /** History and document replacement are standalone transaction boundaries. */
    assertStandalone() {
        if (this._depth > 0)
            throw new Error('History and document replacement cannot run inside an edit transaction');
    }

    private _complete(input: JSONOp, options: ITransactionOptions, mutated = false): ICompletedTransaction {
        const view = mutated ? 'mutated' : options.view ?? 'incremental';
        const history = options.history ?? 'merge';
        let operation = deepClone(input);
        let corrections: JSONOp = null;
        if (operation !== null && !options.replay) {
            const before = this._state.rawState;
            for (const rule of EDITING_RULES) {
                const after = this._state.preview(operation);
                const correction = rule(before, after, operation, this._options());
                operation = json1.type.compose(operation, correction);
                corrections = json1.type.compose(corrections, correction);
            }
        }
        return {
            operation,
            blockOperation: view === 'mutated' ? corrections : operation,
            view,
            history,
            replay: options.replay ?? false,
            source: options.source ?? ChangeSource.User,
            selection: options.selection ?? null,
            recordSelection: options.recordSelection,
        };
    }
}
