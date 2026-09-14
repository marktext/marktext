import type { Doc, JSONOp, JSONOpList, Path } from 'ot-json1';
import type { Muya } from '../muya';
import type { TDiff } from '../utils';
import type { TState } from './types';
import * as json1 from 'ot-json1';
import { deepClone } from '../utils';
import logger from '../utils/logger';
import { getTOC } from './getTOC';

import { MarkdownToState } from './markdownToState';
import StateToMarkdown from './stateToMarkdown';

const debug = logger('jsonState:');

// ot-json1 declares its document type as the opaque `Doc`. Muya treats the
// document as `TState[]`; bridging the two requires `unknown` casts that
// happen at every callsite. Concentrate them here so production code never
// writes `as unknown as Doc` itself.
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

    // Handle of the scheduled deferred-op flush. Doubles as the "a flush is
    // already scheduled" guard (non-null ⇒ batching in progress), and lets
    // `setContent` cancel a pending batch that belongs to the outgoing
    // document (#2938).
    private _rafId: number | null = null;

    private _state: TState[] = [];

    constructor(private _muya: Muya, stateOrMarkdown: TState[] | string) {
        this.setContent(stateOrMarkdown);
    }

    private _apply(op: JSONOp) {
        // ot-json1's noop is the literal `null`. `json1.type.apply` accepts it
        // and returns the doc unchanged — short-circuit instead so the rest of
        // the call site can treat `op` as definitely applied.
        if (op === null)
            return;
        this._state = asState(json1.type.apply(asDoc(this._state), op));
    }

    setContent(content: TState[] | string) {
        // A pending deferred-op batch belongs to the OUTGOING document. Applying
        // it to the new content would corrupt it (or throw and leave the flush
        // guard stuck, freezing all future edits). Drop the batch and cancel its
        // scheduled flush before swapping the state (#2938).
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

    // Parse markdown into a block-state array with the editor's current
    // render-affecting options, WITHOUT mutating `this._state`. Used by
    // `buildReplaceOp` to compute the target state for a bulk replacement.
    markdownToState(markdown: string): TState[] {
        const {
            footnote,
            isGitlabCompatibilityEnabled,
            trimUnnecessaryCodeBlockEmptyLines,
            frontMatter,
            math,
        } = this._muya.options;

        return new MarkdownToState({
            footnote,
            isGitlabCompatibilityEnabled,
            trimUnnecessaryCodeBlockEmptyLines,
            frontMatter,
            math,
        }).generate(markdown);
    }

    /**
     * Build a single, fully-invertible ot-json1 op that turns the CURRENT
     * document state into `content` (markdown or a state array), and return it
     * together with the before/after states.
     *
     * The op is deliberately MOVE-FREE: it replaces each overlapping top-level
     * block, inserts the tail, and removes the surplus (highest index first).
     * It never emits a pick/drop `move`, so `json1.type.apply` reproduces the
     * target state exactly and `invertWithDoc` yields a lossless inverse. The op
     * is applied to the live tree via `ScrollPage.updateState` (a full rebuild),
     * never the incremental DOM walker, so arbitrary block-type changes are safe.
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

        // Compose the components into one op. `json1.type.compose` returns
        // `JSONOp` (= null | JSONOpList) and its identity element is `null`
        // (composing onto `[]` throws "Empty descent"). Start from `null`, then
        // normalize the final result to the empty op `[]` when nothing changed
        // (the documents were identical) so callers can rely on `op.length`.
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

    dispatch(op: JSONOp, source = 'user' /* user, api */) {
        const prevDoc = this.getState();
        this._apply(op);
        // TODO: remove doc in future
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

    // Serialize an ARBITRARY state array to markdown with the same generator
    // `getMarkdown` uses. Used by `Muya.getCursorOffset` to serialize a
    // sentinel-bearing state clone WITHOUT mutating the live `_state`.
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

        // Wrap compose in a lambda — `Array.prototype.reduce` passes
        // (acc, current, index, array) to the callback, but
        // `json1.type.compose` only accepts (op1, op2). Without the
        // wrapper TS rejects the signature mismatch.
        // `compose` returns JSONOp (= null | JSONOpList). Multiple queued
        // operations may cancel each other out (for example during IME
        // composition), producing the identity operation (`null`).
        const op = this._operationCache.reduce(
            (acc, curr) => json1.type.compose(acc, curr) as JSONOpList,
        );
        const prevDoc = this.getState();
        this._apply(op);
        // TODO: remove doc in future
        const doc = this.getState();
        // Clear before emitting: a listener that edits synchronously then starts
        // a fresh batch instead of mutating the one being flushed.
        this._operationCache = [];

        if (op === null)
            return;

        this._muya.eventCenter.emit('json-change', {
            op,
            source: 'user',
            prevDoc,
            doc,
        });
    }
}

export default JSONState;
