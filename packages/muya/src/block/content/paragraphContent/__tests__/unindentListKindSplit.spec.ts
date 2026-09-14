// @vitest-environment happy-dom

import type { TState } from '../../../../state/types';
import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #5341: Shift+Tab on a task item nested in a bullet or ordered list moved it
// into the outer list as a `task-list-item`, which only a `task-list` may
// hold. A list can't mix plain and task items, so the outer list is split
// around the parent item and the outdented item gets a list of its own kind —
// the structure the parser builds when the saved markdown is reopened.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function contentByText(muya: Muya, text: string): Content {
    let target: Content | null = null;
    const visit = (block: {
        text?: string;
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName?.endsWith('.content') && block.text === text)
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error(`content block with text "${text}" not found`);
    return target;
}

function outdent(muya: Muya, text: string): void {
    const content = contentByText(muya, text);
    muya.editor.activeContentBlock = content;
    content.setCursor(text.length, text.length, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Tab',
        shiftKey: true,
    } as unknown as KeyboardEvent;
    content.tabHandler(event);
    muya.editor.jsonState.flush();
}

const LIST_ITEM_KIND: Record<string, string> = {
    'bullet-list': 'list-item',
    'order-list': 'list-item',
    'task-list': 'task-list-item',
};

/** Every list holds only the item kind it allows. */
function assertListsHoldTheirOwnItems(state: TState[]): void {
    for (const node of state) {
        if (!('children' in node) || !Array.isArray(node.children))
            continue;
        const itemKind = LIST_ITEM_KIND[node.name];
        if (itemKind) {
            for (const child of node.children)
                expect(child.name, `${node.name} must not hold ${child.name}`).toBe(itemKind);
        }
        assertListsHoldTheirOwnItems(node.children as TState[]);
    }
}

/**
 * The state after the outdent must be exactly what the parser builds from the
 * markdown it serializes to, or reopening the file would change the document.
 */
function expectStableAcrossReopen(muya: Muya): TState[] {
    const state = muya.editor.jsonState.getState();
    const markdown = muya.getMarkdown();
    muya.setContent(markdown);
    expect(muya.editor.jsonState.getState()).toEqual(state);
    expect(muya.getMarkdown()).toBe(markdown);
    return state;
}

const paragraph = (text: string) => ({ name: 'paragraph', text });
const item = (text: string) => ({ name: 'list-item', children: [paragraph(text)] });
const task = (text: string, checked = false) => ({ name: 'task-list-item', meta: { checked }, children: [paragraph(text)] });

describe('paragraphContent — Shift+Tab across plain and task lists (#5341)', () => {
    it('moves a task item out of a bullet list into a task list of its own', () => {
        const muya = bootMuya('- a\n  - [ ] b\n');
        outdent(muya, 'b');

        const state = muya.editor.jsonState.getState();
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            { name: 'bullet-list', meta: { marker: '-', loose: false }, children: [item('a')] },
            { name: 'task-list', meta: { marker: '-', loose: false }, children: [task('b')] },
        ]);
        expect(muya.getMarkdown()).toBe('- a\n- [ ] b\n');
        expectStableAcrossReopen(muya);
    });

    it('keeps the checked state and the caret in the outdented item', () => {
        const muya = bootMuya('- a\n  - [x] b\n');
        outdent(muya, 'b');

        const state = muya.editor.jsonState.getState();
        expect(state[1]).toEqual({ name: 'task-list', meta: { marker: '-', loose: false }, children: [task('b', true)] });
        const active = muya.editor.activeContentBlock!;
        expect(active.text).toBe('b');
        expect(active.getCursor()!.start.offset).toBe(1);
    });

    it('moves the items after the parent item into a list of the outer kind', () => {
        const muya = bootMuya('- a\n  - [ ] b\n- c\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        assertListsHoldTheirOwnItems(state);
        expect(state.map(block => block.name)).toEqual(['bullet-list', 'task-list', 'bullet-list']);
        expect(muya.getMarkdown()).toBe('- a\n- [ ] b\n- c\n');
    });

    it('continues the numbering of an ordered outer list after the split', () => {
        const muya = bootMuya('1. a\n   - [ ] b\n2. c\n3. d\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            { name: 'order-list', meta: { start: 1, delimiter: '.', loose: false }, children: [item('a')] },
            { name: 'task-list', meta: { marker: '-', loose: false }, children: [task('b')] },
            { name: 'order-list', meta: { start: 2, delimiter: '.', loose: false }, children: [item('c'), item('d')] },
        ]);
    });

    it('moves a plain item out of a task list into a bullet list of its own', () => {
        const muya = bootMuya('- [ ] a\n  - b\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            { name: 'task-list', meta: { marker: '-', loose: false }, children: [task('a')] },
            { name: 'bullet-list', meta: { marker: '-', loose: false }, children: [item('b')] },
        ]);
    });

    it('joins a task list that already follows the outer list', () => {
        const muya = bootMuya('- a\n  - [ ] b\n- [ ] x\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            { name: 'bullet-list', meta: { marker: '-', loose: false }, children: [item('a')] },
            { name: 'task-list', meta: { marker: '-', loose: false }, children: [task('b'), task('x')] },
        ]);
    });

    it('keeps a different marker as its own list', () => {
        const muya = bootMuya('- a\n  * [ ] b\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        assertListsHoldTheirOwnItems(state);
        expect(state.map(block => [block.name, 'meta' in block ? block.meta : null])).toEqual([
            ['bullet-list', { marker: '-', loose: false }],
            ['task-list', { marker: '*', loose: false }],
        ]);
    });

    it('still carries remaining sibling items and trailing content into the outdented item', () => {
        const muya = bootMuya('- a\n  - [ ] b\n  - [ ] d\n\n  c\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        assertListsHoldTheirOwnItems(state);
        expect(state.map(block => block.name)).toEqual(['bullet-list', 'task-list']);
        const outdented = (state[1] as { children: TState[] }).children[0] as { children: TState[] };
        expect(outdented.children.map(child => child.name)).toEqual(['paragraph', 'task-list', 'paragraph']);
    });

    it('leaves items of the same kind in the outer list', () => {
        const muya = bootMuya('1. a\n   - b\n');
        outdent(muya, 'b');

        const state = expectStableAcrossReopen(muya);
        expect(state).toEqual([
            { name: 'order-list', meta: { start: 1, delimiter: '.', loose: false }, children: [item('a'), item('b')] },
        ]);
    });

    it('undoes the split in one step', async () => {
        const muya = bootMuya('- a\n  - [ ] b\n- c\n');
        const original = muya.getMarkdown();
        outdent(muya, 'b');
        expect(muya.getMarkdown()).not.toBe(original);

        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe(original);
        });
    });
});
