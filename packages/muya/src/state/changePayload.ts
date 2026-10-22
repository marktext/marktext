import type { JSONOp } from 'ot-json1';
import type { ChangeSource } from '../types';
import type { TState } from './types';
import { deepClone } from '../utils';

export interface IJSONChangePayload {
    op: JSONOp;
    source: ChangeSource;
    prevDoc: TState[];
    doc: TState[];
}

// Internal History reads the pre-apply root without exposing shared subtrees
// to public listeners.
const previousRoots = new WeakMap<object, TState[]>();

export function createChangePayload(op: JSONOp, source: ChangeSource, before: TState[], after: TState[]): IJSONChangePayload {
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
