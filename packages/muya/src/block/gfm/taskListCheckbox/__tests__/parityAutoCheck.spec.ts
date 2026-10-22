import type TaskListItem from '../../taskListItem';
// @vitest-environment happy-dom

import type TaskListCheckbox from '../index';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';
import { ChangeSource } from '../../../../types';

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

            checkboxOf(parent).update(true, ChangeSource.User);

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

            checkboxOf(child1).update(true, ChangeSource.User);
            checkboxOf(child2).update(true, ChangeSource.User);

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
            checkboxOf(parent).update(true, ChangeSource.User);

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

            checkboxOf(parent).update(true, ChangeSource.User);

            await vi.waitFor(() => {
                expect(checkedFlags(muya)).toEqual([true, false, false]);
            });

            const markdown = muya.getMarkdown();
            expect(markdown).toContain('- [x] parent');
            expect(markdown).toContain('- [ ] child1');
            expect(markdown).toContain('- [ ] child2');
        },
    );
});
