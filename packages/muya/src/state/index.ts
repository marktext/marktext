import type { Doc, JSONOp, JSONOpList } from 'ot-json1';
import type { Muya } from '../muya';
import type { TState } from './types';
import * as json1 from 'ot-json1';
import { deepClone } from '../utils';
import { getTOC } from './getTOC';

import { MarkdownToState } from './markdownToState';
import StateToMarkdown from './stateToMarkdown';

export function asDoc(state: readonly TState[] | TState): Doc {
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

    private _state: TState[] = [];

    private _revision = 0;

    constructor(private _muya: Muya, stateOrMarkdown: TState[] | string) {
        this.setContent(stateOrMarkdown);
    }

    get revision() {
        return this._revision;
    }

    /** Read-only candidate: owns inserted values, shares untouched subtrees. */
    preview(op: JSONOp): readonly TState[] {
        return op === null ? this._state : asState(json1.type.apply(asDoc(this._state), deepClone(op)));
    }

    /** Apply a complete operation exactly as supplied, without editing rules or events. */
    apply(op: JSONOp) {
        if (op === null)
            return;
        this._state = asState(this.preview(op));
        this._revision += 1;
    }

    setContent(content: TState[] | string) {
        if (typeof content === 'object')
            this._setState(content);
        else
            this._setMarkdown(content);
        this._revision += 1;
    }

    private _setState(state: TState[]) {
        this._state = deepClone(state);
    }

    private _setMarkdown(markdown: string) {
        this._state = this.markdownToState(markdown);
    }

    markdownToState(markdown: string): TState[] {
        return new MarkdownToState(this._muya.options).generate(markdown);
    }

    /**
     * Build an invertible replacement operation; null means no change.
     * Uses top-level replacements rather than moves; callers must rebuild the
     * block tree instead of applying it through the incremental DOM walker.
     */
    buildReplaceOp(content: TState[] | string): JSONOp {
        const prevState = this._state;
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

        return composed;
    }

    /**
     * Complete logical state. Consumers must never mutate this tree.
     * @internal
     */
    get rawState(): readonly TState[] {
        return this._state;
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
}

export default JSONState;
