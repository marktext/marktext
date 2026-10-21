import type { Doc, JSONOp, JSONOpList, Path } from 'ot-json1';
import type { Muya } from '../muya';
import type { TDiff } from '../utils';
import type { TState } from './types';
import * as json1 from 'ot-json1';
import { ChangeSource } from '../types';
import { deepClone } from '../utils';
import logger from '../utils/logger';
import { getTOC } from './getTOC';

import { MarkdownToState } from './markdownToState';
import StateToMarkdown from './stateToMarkdown';

const debug = logger('jsonState:');

export function asDoc(state: TState[] | TState): Doc {
    // eslint-disable-next-line no-restricted-syntax
    return state as unknown as Doc;
}

export function asState(doc: unknown): TState[] {
    return doc as TState[];
}

class JSONState {
    static invert(op: JSONOpList) {
        return json1.type.invert(op);
    }

    static compose(op1: JSONOpList, op2: JSONOpList) {
        return json1.type.compose(op1, op2);
    }

    static transform(
        op: JSONOpList,
        otherOp: JSONOpList,
        type: 'left' | 'right',
    ) {
        return json1.type.transform(op, otherOp, type);
    }

    private _operationCache: JSONOpList[] = [];

    // Pending frame flush, also used to cancel edits belonging to an outgoing document (#2938).
    private _rafId: number | null = null;

    private _state: TState[] = [];

    constructor(private _muya: Muya, stateOrMarkdown: TState[] | string) {
        this.setContent(stateOrMarkdown);
    }

    private _apply(op: JSONOp) {
        if (op === null)
            return;
        this._state = asState(json1.type.apply(asDoc(this._state), op));
    }

    setContent(content: TState[] | string) {
        // Discard the outgoing document’s pending edits before loading a replacement.
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._operationCache = [];

        if (typeof content === 'object')
            this._setState(content);
        else
            this._setMarkdown(content);
    }

    private _setState(state: TState[]) {
        this._state = state;
    }

    private _setMarkdown(markdown: string) {
        this._state = this.markdownToState(markdown);
    }

    markdownToState(markdown: string): TState[] {
        return new MarkdownToState(this._muya.options).generate(markdown);
    }

    /**
     * Build an invertible replacement operation and its before/after states.
     * Uses top-level replacements rather than moves; callers must rebuild the
     * block tree instead of applying it through the incremental DOM walker.
     */
    buildReplaceOp(content: TState[] | string): {
        op: JSONOpList;
        prevState: TState[];
        nextState: TState[];
    } {
        const prevState = this.getState();
        const nextState
            = typeof content === 'string' ? this.markdownToState(content) : deepClone(content);

        const components: JSONOpList[] = [];
        const max = Math.max(prevState.length, nextState.length);

        for (let i = 0; i < max; i++) {
            if (i < prevState.length && i < nextState.length) {
                if (
                    JSON.stringify(prevState[i]) !== JSON.stringify(nextState[i])
                ) {
                    components.push(
                        json1.replaceOp(
                            [i],
                            asDoc(prevState[i]),
                            asDoc(nextState[i]),
                        )!,
                    );
                }
            }
            else if (i < nextState.length) {
                components.push(json1.insertOp([i], asDoc(nextState[i]))!);
            }
        }

        // Remove surplus trailing blocks from the end so earlier indices stay
        // stable while composing.
        for (let i = prevState.length - 1; i >= nextState.length; i--)
            components.push(json1.removeOp([i])!);

        // Compose from null: an empty array is not a valid json1 identity operation.
        let composed: JSONOp = null;
        for (const component of components)
            composed = json1.type.compose(composed, component);

        const op: JSONOpList = composed ?? [];

        return { op, prevState, nextState };
    }

    insertOperation(path: Path, state: TState) {
        const operation = json1.insertOp(path, asDoc(state))!;

        this._operationCache.push(operation);

        this._emitStateChange();
    }

    removeOperation(path: Path) {
        const operation = json1.removeOp(path)!;

        this._operationCache.push(operation);

        this._emitStateChange();
    }

    editOperation(path: Path, diff: TDiff[]) {
        const operation = json1.editOp(path, 'text-unicode', diff)!;

        this._operationCache.push(operation);

        this._emitStateChange();
    }

    replaceOperation(path: Path, oldValue: Doc, newValue: Doc) {
        const operation = json1.replaceOp(path, oldValue, newValue)!;

        this._operationCache.push(operation);

        this._emitStateChange();
    }

    // Adds a key that is not present yet. `editOperation` cannot be used for
    // that: a text-unicode op against an absent member fails in ot-json1.
    insertValueOperation(path: Path, value: Doc) {
        const operation = json1.insertOp(path, value)!;

        this._operationCache.push(operation);

        this._emitStateChange();
    }

    dispatch(op: JSONOp, source: ChangeSource = ChangeSource.User) {
        const prevDoc = this.getState();
        this._apply(op);
        const doc = this.getState();
        debug.log(JSON.stringify(op));
        this._muya.eventCenter.emit('json-change', {
            op,
            source,
            prevDoc,
            doc,
        });
    }

    getState(): TState[] {
        return deepClone(this._state);
    }

    getMarkdown() {
        return this.getMarkdownFromState(this.getState());
    }

    getTOC() {
        return getTOC(this._muya);
    }

    // Serialize supplied state without changing the live document.
    getMarkdownFromState(state: TState[]): string {
        const mdGenerator = new StateToMarkdown({
            listIndentation: this._muya.options.listIndentation,
        });

        return mdGenerator.generate(state);
    }

    private _emitStateChange() {
        if (this._rafId !== null)
            return;

        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            this._flushOperationCache();
        });
    }

    // Apply queued edits to the current document now instead of on the next
    // frame. Lets a tab switch persist the outgoing tab's last keystroke before
    // `setContent` replaces the document, otherwise that edit is lost (#2938).
    flush() {
        if (this._rafId === null)
            return;

        cancelAnimationFrame(this._rafId);
        this._rafId = null;
        this._flushOperationCache();
    }

    private _flushOperationCache() {
        if (!this._operationCache.length)
            return;

        // Use a two-argument wrapper: reduce also passes indices that json1.compose does not accept.
        // Queued IME edits may cancel to the identity operation (null).
        const op = this._operationCache.reduce(
            (acc, curr) => json1.type.compose(acc, curr) as JSONOpList,
        );
        const prevDoc = this.getState();
        this._apply(op);
        const doc = this.getState();
        // Clear before emitting: a listener that edits synchronously then starts
        // a fresh batch instead of mutating the one being flushed.
        this._operationCache = [];

        if (op === null)
            return;

        this._muya.eventCenter.emit('json-change', {
            op,
            source: ChangeSource.User,
            prevDoc,
            doc,
        });
    }
}

export default JSONState;
