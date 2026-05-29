import type { Doc, JSONOp, JSONOpList, Path } from 'ot-json1';
import type { Muya } from '../muya';
import type { TDiff } from '../utils';
import type { TState } from './types';
import * as json1 from 'ot-json1';
import { deepClone } from '../utils';
import logger from '../utils/logger';
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

    private _isGoing = false;

    private _state: TState[] = [];

    constructor(public muya: Muya, stateOrMarkdown: TState[] | string) {
        this.setContent(stateOrMarkdown);
    }

    apply(op: JSONOp) {
        // ot-json1's noop is the literal `null`. `json1.type.apply` accepts it
        // and returns the doc unchanged — short-circuit instead so the rest of
        // the call site can treat `op` as definitely applied.
        if (op === null)
            return;
        this._state = asState(json1.type.apply(asDoc(this._state), op));
    }

    setContent(content: TState[] | string) {
        if (typeof content === 'object')
            this.setState(content);
        else
            this.setMarkdown(content);
    }

    setState(state: TState[]) {
        this._state = state;
    }

    setMarkdown(markdown: string) {
        const {
            footnote,
            isGitlabCompatibilityEnabled,
            trimUnnecessaryCodeBlockEmptyLines,
            frontMatter,
            math,
        } = this.muya.options;

        this._state = new MarkdownToState({
            footnote,
            isGitlabCompatibilityEnabled,
            trimUnnecessaryCodeBlockEmptyLines,
            frontMatter,
            math,
        }).generate(markdown);
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
        this.apply(op);
        // TODO: remove doc in future
        const doc = this.getState();
        debug.log(JSON.stringify(op));
        this.muya.eventCenter.emit('json-change', {
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
        const state = this.getState();
        const mdGenerator = new StateToMarkdown();

        return mdGenerator.generate(state);
    }

    private _emitStateChange() {
        if (this._isGoing)
            return;

        this._isGoing = true;

        requestAnimationFrame(() => {
            // Wrap compose in a lambda — `Array.prototype.reduce` passes
            // (acc, current, index, array) to the callback, but
            // `json1.type.compose` only accepts (op1, op2). Without the
            // wrapper TS rejects the signature mismatch.
            // `compose` returns JSONOp (= null | JSONOpList); when the cache
            // contains at least one op the result is the composed list,
            // never null. The reduce above runs only when _operationCache is
            // non-empty (guarded by the requestAnimationFrame in
            // `_emitStateChange`), and a non-empty cache always composes to
            // a non-null op.
            const op = this._operationCache.reduce(
                (acc, curr) => json1.type.compose(acc, curr) as JSONOpList,
            );
            const prevDoc = this.getState();
            this.apply(op);
            // TODO: remove doc in future
            const doc = this.getState();
            this.muya.eventCenter.emit('json-change', {
                op,
                source: 'user',
                prevDoc,
                doc,
            });
            this._operationCache = [];
            this._isGoing = false;
        });
    }
}

export default JSONState;
