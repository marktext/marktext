import type { Path } from 'ot-json1';

export function stateAtPath(root: unknown, path: Path): unknown {
    let value = root;
    for (const key of path) {
        if (!value || typeof value !== 'object')
            return undefined;
        value = (value as Record<string | number, unknown>)[key];
    }
    return value;
}
