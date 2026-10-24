import type { JSONOp, Path } from 'ot-json1';
import type { TState } from '../state/types';
import { type as json1 } from 'ot-json1';
import { beginRules } from './rules';

function isDefinition(root: readonly TState[], path: Path): boolean {
    let value: unknown = root;
    for (const key of path) {
        if (!value || typeof value !== 'object')
            return false;
        value = (value as Record<string | number, unknown>)[key];
    }
    return !!value && typeof value === 'object' && 'name' in value && value.name === 'paragraph'
        && 'text' in value && typeof value.text === 'string' && beginRules.reference_definition.test(value.text);
}

/** Structural edits may change definition order; ordinary text and metadata need not rescan the index. */
export function referenceDefinitionsChanged(before: readonly TState[], after: readonly TState[], operation: JSONOp): boolean {
    if (operation === null)
        return false;
    let changed = false;
    const cursor = json1.readCursor(operation);
    cursor.traverse(null, () => {
        if (changed)
            return;
        const path = cursor.getPath();
        if (path.includes('meta'))
            return;
        if (path[path.length - 1] !== 'text') {
            changed = true;
            return;
        }
        const owner = path.slice(0, -1);
        changed = isDefinition(before, owner) || isDefinition(after, owner);
    });
    return changed;
}
