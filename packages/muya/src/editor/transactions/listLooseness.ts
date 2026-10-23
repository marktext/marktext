import type { JSONOp, JSONOpComponent, Path } from 'ot-json1';
import type { IBulletListState, IOrderListState, ITaskListState, TState } from '../../state/types';
import type { IMuyaOptions } from '../../types';
import { type as json1, replaceOp } from 'ot-json1';
import { MarkdownToState } from '../../state/markdownToState';
import ExportMarkdown from '../../state/stateToMarkdown';
import { isAnyListState, markdownListMarker } from '../../state/types';

type TList = IBulletListState | IOrderListState | ITaskListState;

interface IListLocation {
    siblings: readonly TState[];
    index: number;
    parentPath: Path;
}

function atPath(root: unknown, path: Path): unknown {
    let value = root;
    for (const key of path) {
        if (!value || typeof value !== 'object')
            return undefined;
        value = (value as Record<string | number, unknown>)[key];
    }
    return value;
}

function isState(value: unknown): value is TState {
    return !!value && typeof value === 'object' && 'name' in value;
}

function changesLayout(previous: readonly TState[], root: readonly TState[], path: Path): boolean {
    if (path[path.length - 1] !== 'text')
        return true;
    const owner = atPath(root, path.slice(0, -1));
    if (isState(owner) && owner.name === 'paragraph') {
        const before = atPath(previous, path.slice(0, -1));
        // An empty final paragraph can disappear on export/import; its first
        // visible character makes the separator affect list looseness.
        return !isState(before) || before.name !== 'paragraph'
            || /^[ \t\r\n]*$/.test(before.text) !== /^[ \t\r\n]*$/.test(owner.text);
    }
    return isState(owner) && (owner.name === 'html-block' || owner.name === 'thematic-break');
}

function collectCandidates(previous: readonly TState[], root: readonly TState[], op: JSONOp): IListLocation[] {
    const candidates = new Map<TState, IListLocation>();
    const add = (siblings: readonly TState[], index: number, parentPath: Path) => {
        const state = siblings[index];
        if (state && isAnyListState(state))
            candidates.set(state, { siblings, index, parentPath });
    };
    const subtree = (value: unknown, path: Path) => {
        const stack = [{ value, path }];
        while (stack.length) {
            const current = stack.pop()!;
            if (Array.isArray(current.value)) {
                current.value.forEach((child, index) => {
                    add(current.value as TState[], index, current.path);
                    stack.push({ value: child, path: [...current.path, index] });
                });
            }
            else if (isState(current.value) && 'children' in current.value) {
                stack.push({ value: current.value.children, path: [...current.path, 'children'] });
            }
        }
    };
    const cursor = json1.readCursor(op);
    cursor.traverse(null, (component: JSONOpComponent) => {
        const path = cursor.getPath();
        if (!changesLayout(previous, root, path))
            return;
        for (let depth = 0; depth < path.length; depth++) {
            const parentPath = path.slice(0, depth);
            const siblings = atPath(root, parentPath);
            const index = path[depth];
            if (Array.isArray(siblings) && typeof index === 'number') {
                for (const offset of [-1, 0, 1])
                    add(siblings, index + offset, parentPath);
            }
        }
        if (typeof component.i === 'object' || component.d !== undefined)
            subtree(atPath(root, path), path);
    });
    return [...candidates.values()];
}

function needsLoose(list: TList, options: IMuyaOptions): boolean {
    if (!list.children.some(item => item.children.length > 1))
        return false;
    // Use the actual export/import boundary rules, including nested lists and
    // enabled extensions, instead of maintaining a second list grammar here.
    const markdown = new ExportMarkdown({ listIndentation: options.listIndentation }).generate([list]);
    return new MarkdownToState(options).generate(markdown).some(state => isAnyListState(state) && state.meta.loose);
}

/** Promote affected logical lists; authored loose spacing is never tightened. */
export function listLoosenessOperations(previous: readonly TState[], root: readonly TState[], op: JSONOp, options: IMuyaOptions) {
    let operation: JSONOp = null;
    const visited = new Set<TState>();
    for (const location of collectCandidates(previous, root, op)) {
        const { siblings, parentPath } = location;
        const list = siblings[location.index] as TList;
        if (visited.has(list))
            continue;
        const marker = markdownListMarker(list);
        const matches = (index: number) => {
            const state = siblings[index];
            return state && isAnyListState(state) && markdownListMarker(state) === marker;
        };
        let start = location.index;
        let end = start + 1;
        while (matches(start - 1)) start--;
        while (matches(end)) end++;
        const group = siblings.slice(start, end) as TList[];
        group.forEach(state => visited.add(state));
        // Bullet/task runs with the same marker are one Markdown list, so
        // looseness must agree across every internal run of that list.
        if (!group.some(state => state.meta.loose || needsLoose(state, options)))
            continue;
        group.forEach((state, offset) => {
            if (state.meta.loose)
                return;
            const path = [...parentPath, start + offset];
            operation = json1.compose(operation, replaceOp([...path, 'meta', 'loose'], false, true));
        });
    }
    return operation;
}
