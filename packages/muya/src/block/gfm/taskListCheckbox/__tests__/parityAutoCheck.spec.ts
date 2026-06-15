// @vitest-environment happy-dom

import type TaskListItem from '../../taskListItem';
import type TaskListCheckbox from '../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// PARITY SCOREBOARD — gap PG3 (file PG03).
//
// Legacy `packages/muyajs` read `muya.options.autoCheck` in
// `clickCtrl.js#listItemCheckBoxClick`: toggling a task-list checkbox with
// `autoCheck` on cascaded the state to all descendant checkboxes
// (`updateChildrenCheckBoxState`) and re-derived ancestors
// (`updateParentsCheckBoxState`).
//
// `block/gfm/taskListCheckbox/index.ts#update` now reads `muya.options.autoCheck`
// and, for a `user` toggle, cascades the state to every descendant task item and
// re-derives each ancestor — restoring parity.
//
// We drive the checkbox's `update(checked, 'user')` directly — that is exactly
// what the DOM click handler invokes — and assert the cascade.

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    // `destroy()` detaches the engine's DOM listeners — including the
    // `document`-level handlers registered during init — and removes the host
    // node, so listeners don't leak across tests.
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {
        markdown,
        ...options,
    } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

// A parent task item with two nested children, all unchecked. State shape:
//   task-list > task-list-item(meta.checked) > [ paragraph, task-list > ... ]
const NESTED_TASKS = '- [ ] parent\n\n  - [ ] child1\n  - [ ] child2\n';

// Collect every task-list-item block in document order [parent, child1, child2].
function taskItems(muya: Muya): TaskListItem[] {
    const items: TaskListItem[] = [];
    const visit = (block: { constructor: { blockName?: string }; children?: { forEach: (cb: (b: unknown) => void) => void } }) => {
        if ((block.constructor as { blockName?: string }).blockName === 'task-list-item')
            items.push(block as unknown as TaskListItem);
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    return items;
}

// The checkbox is attached to its task-list-item via `appendAttachment`.
function checkboxOf(item: TaskListItem): TaskListCheckbox {
    let found: TaskListCheckbox | null = null;
    (item.attachments as unknown as { forEach: (cb: (a: TaskListCheckbox) => void) => void }).forEach((a) => {
        if ((a.constructor as { blockName?: string }).blockName === 'task-list-checkbox')
            found = a;
    });
    if (!found)
        throw new Error('task-list-checkbox attachment not found');
    return found;
}

// Read the checked flags off the document state, in order
// [parent, child1, child2].
function checkedFlags(muya: Muya): boolean[] {
    const flags: boolean[] = [];
    const walk = (nodes: ReturnType<Muya['getState']>) => {
        for (const node of nodes) {
            const n = node as { name: string; meta?: { checked?: boolean }; children?: unknown };
            if (n.name === 'task-list-item')
                flags.push(!!n.meta?.checked);
            if (Array.isArray(n.children))
                walk(n.children as ReturnType<Muya['getState']>);
        }
    };
    walk(muya.getState());
    return flags;
}

describe('parity PG3: autoCheck task-list cascade', () => {
    it(
        'PG3: autoCheck cascades the toggle to descendant task items',
        async () => {
            const muya = bootMuya(NESTED_TASKS, { autoCheck: true });
            const [parent] = taskItems(muya);
            expect(checkedFlags(muya)).toEqual([false, false, false]);

            // Equivalent to clicking the parent checkbox (the real DOM handler
            // calls `update(checked, 'user')`).
            checkboxOf(parent).update(true, 'user');

            // Desired: checking the parent cascades to both children.
            await vi.waitFor(() => {
                expect(checkedFlags(muya)).toEqual([true, true, true]);
            });
        },
    );

    it(
        'PG3: autoCheck re-derives the parent when all descendants become checked',
        async () => {
            const muya = bootMuya(NESTED_TASKS, { autoCheck: true });
            const [, child1, child2] = taskItems(muya);
            expect(checkedFlags(muya)).toEqual([false, false, false]);

            checkboxOf(child1).update(true, 'user');
            checkboxOf(child2).update(true, 'user');

            // Desired: when every child is checked, the parent becomes checked.
            await vi.waitFor(() => {
                expect(checkedFlags(muya)).toEqual([true, true, true]);
            });
        },
    );

    it(
        'PG3: autoCheck:false leaves descendants untouched when the parent toggles',
        async () => {
            const muya = bootMuya(NESTED_TASKS, { autoCheck: false });
            const [parent] = taskItems(muya);
            expect(checkedFlags(muya)).toEqual([false, false, false]);

            // The DOM click handler invokes `update(checked, 'user')`. With
            // `autoCheck` disabled, the cascade guard (`source !== 'api' &&
            // this.muya.options.autoCheck`) is false, so only the toggled item
            // changes — descendants stay unchecked.
            checkboxOf(parent).update(true, 'user');

            await vi.waitFor(() => {
                expect(checkedFlags(muya)).toEqual([true, false, false]);
            });
        },
    );

    it(
        'PG3: a checked task item serializes as "- [x]"',
        async () => {
            const muya = bootMuya(NESTED_TASKS, { autoCheck: false });
            const [parent] = taskItems(muya);

            checkboxOf(parent).update(true, 'user');

            await vi.waitFor(() => {
                expect(checkedFlags(muya)).toEqual([true, false, false]);
            });

            const markdown = muya.getMarkdown();
            // The checked parent emits the GFM checked marker; the unchecked
            // children keep the empty marker.
            expect(markdown).toContain('- [x] parent');
            expect(markdown).toContain('- [ ] child1');
            expect(markdown).toContain('- [ ] child2');
        },
    );
});
