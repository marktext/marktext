// @vitest-environment happy-dom

import type { TState } from '../../../../state/types';
import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #5349: Tab nests an item under the previous item and appended it to that
// item's trailing sublist even when the sublist holds the other item kind, so
// a task item landed in a bullet list (or a plain item in a task list). The
// item keeps its kind and gets a list of its own kind after that sublist — the
// structure the parser builds when the saved markdown is reopened.

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

function indent(muya: Muya, text: string): void {
    const content = contentByText(muya, text);
    muya.editor.activeContentBlock = content;
    content.setCursor(text.length, text.length, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Tab',
        shiftKey: false,
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
 * The state after the indent must be exactly what the parser builds from the
 * markdown it serializes to, or reopening the file would change the document.
 */
function expectStableAcrossReopen(muya: Muya): void {
    const state = muya.editor.jsonState.getState();
    const markdown = muya.getMarkdown();
    muya.setContent(markdown);
    expect(muya.editor.jsonState.getState()).toEqual(state);
    expect(muya.getMarkdown()).toBe(markdown);
}

function paragraph(text: string): TState {
    return { name: 'paragraph', text } as TState;
}

function item(text: string, ...children: TState[]): TState {
    return { name: 'list-item', children: [paragraph(text), ...children] } as TState;
}

function task(text: string, checked = false, ...children: TState[]): TState {
    return { name: 'task-list-item', meta: { checked }, children: [paragraph(text), ...children] } as TState;
}

function bullets(...children: TState[]): TState {
    return { name: 'bullet-list', meta: { marker: '-', loose: false }, children } as TState;
}

function tasks(...children: TState[]): TState {
    return { name: 'task-list', meta: { marker: '-', loose: false }, children } as TState;
}

describe('paragraphContent — Tab into a sublist of the other item kind (#5349)', () => {
    it('gives a task item a task list after the previous item\'s bullet sublist', () => {
        const muya = bootMuya('- [ ] a\n  - b\n- [ ] c\n');
        indent(muya, 'c');

        const state = muya.editor.jsonState.getState();
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            tasks(task('a', false, bullets(item('b')), tasks(task('c')))),
        ]);
        expectStableAcrossReopen(muya);
    });

    it('gives a plain item a bullet list after the previous item\'s task sublist', () => {
        const muya = bootMuya('- a\n  - [ ] b\n- c\n');
        indent(muya, 'c');

        const state = muya.editor.jsonState.getState();
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            bullets(item('a', tasks(task('b')), bullets(item('c')))),
        ]);
        expectStableAcrossReopen(muya);
    });

    it('keeps an ordered item ordered next to a task sublist', () => {
        const muya = bootMuya('1. a\n   - [ ] b\n2. c\n');
        indent(muya, 'c');

        const state = muya.editor.jsonState.getState();
        assertListsHoldTheirOwnItems(state);
        const outer = state[0] as { name: string; children: Array<{ children: TState[] }> };
        expect(outer.name).toBe('order-list');
        expect(outer.children).toHaveLength(1);
        expect(outer.children[0].children.map(child => child.name)).toEqual(['paragraph', 'task-list', 'order-list']);
        expectStableAcrossReopen(muya);
    });

    it('keeps the checked state and the caret, and the next item of that kind joins the new list', () => {
        const muya = bootMuya('- [ ] a\n  - b\n- [x] c\n- [ ] d\n');
        indent(muya, 'c');

        const active = muya.editor.activeContentBlock!;
        expect(active.text).toBe('c');
        expect(active.getCursor()!.start.offset).toBe(1);

        indent(muya, 'd');
        const state = muya.editor.jsonState.getState();
        assertListsHoldTheirOwnItems(state);
        expect(state).toEqual([
            tasks(task('a', false, bullets(item('b')), tasks(task('c', true), task('d')))),
        ]);
        expectStableAcrossReopen(muya);
    });

    it('stays stable across a reopen when the lists are loose', () => {
        const muya = bootMuya('- [ ] a\n\n  - b\n\n- [ ] c\n');
        indent(muya, 'c');

        assertListsHoldTheirOwnItems(muya.editor.jsonState.getState());
        expectStableAcrossReopen(muya);
    });
});

describe('paragraphContent — Tab keeps working where the kinds already match (#5349)', () => {
    it('appends to a sublist of the same kind', () => {
        const muya = bootMuya('- a\n  - b\n- c\n');
        indent(muya, 'c');

        expect(muya.editor.jsonState.getState()).toEqual([
            bullets(item('a', bullets(item('b'), item('c')))),
        ]);
        expectStableAcrossReopen(muya);
    });

    it('creates a sublist of the item\'s own kind when the previous item has none', () => {
        const muya = bootMuya('- [ ] a\n- [ ] c\n');
        indent(muya, 'c');

        expect(muya.editor.jsonState.getState()).toEqual([
            tasks(task('a', false, tasks(task('c')))),
        ]);
        expectStableAcrossReopen(muya);
    });

    it('undo restores the document', () => {
        const muya = bootMuya('- [ ] a\n  - b\n- [ ] c\n');
        const before = muya.getMarkdown();
        indent(muya, 'c');
        muya.undo();
        muya.editor.jsonState.flush();

        expect(muya.getMarkdown()).toBe(before);
    });
});
