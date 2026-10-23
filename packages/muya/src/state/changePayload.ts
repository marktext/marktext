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
const previousRoots = new WeakMap<object, readonly TState[]>();
const historySuppressed = new WeakSet<object>();

export function createChangePayload(op: JSONOp, source: ChangeSource, before: readonly TState[], after: readonly TState[], recordHistory = true): IJSONChangePayload {
    let prevDoc: TState[] | undefined;
    let doc: TState[] | undefined;
    const payload = {
        op,
        source,
        get prevDoc() {
            return prevDoc ??= deepClone(before) as TState[];
        },
        get doc() {
            return doc ??= deepClone(after) as TState[];
        },
    };
    previousRoots.set(payload, before);
    if (!recordHistory)
        historySuppressed.add(payload);
    return payload;
}

// Suppression belongs to one event; reentrant edits retain their own policy.
export function isHistorySuppressed(payload: IJSONChangePayload): boolean {
    return historySuppressed.has(payload);
}

/**
 * Read-only input for History; also accepts manually emitted events.
 * @internal
 */
export function getPreviousDoc(payload: Pick<IJSONChangePayload, 'prevDoc'>): readonly TState[] {
    return previousRoots.get(payload) ?? payload.prevDoc;
}
