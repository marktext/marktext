import type { JSONOp } from 'ot-json1';
import type { TState } from './types';
import { deepClone } from '../utils';

export interface IJSONChangePayload {
    op: JSONOp;
    source: string;
    prevDoc: TState[];
    doc: TState[];
}

// Internal History reads the pre-apply root without exposing shared subtrees
// to public listeners. Neither this map nor the lazy getters retain Muya.
const previousRoots = new WeakMap<object, TState[]>();

export function createChangePayload(op: JSONOp, source: string, before: TState[], after: TState[]): IJSONChangePayload {
    let prevDoc: TState[] | undefined;
    let doc: TState[] | undefined;
    const payload = {
        op,
        source,
        get prevDoc() {
            return prevDoc ??= deepClone(before);
        },
        get doc() {
            return doc ??= deepClone(after);
        },
    };
    previousRoots.set(payload, before);
    return payload;
}

/**
 * Read-only input for History; also accepts manually emitted events.
 * @internal
 */
export function getPreviousDoc(payload: Pick<IJSONChangePayload, 'prevDoc'>): TState[] {
    return previousRoots.get(payload) ?? payload.prevDoc;
}
