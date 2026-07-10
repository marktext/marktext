// @vitest-environment happy-dom

import type { TState } from '../../../../state/types';
import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #4644 — pressing Enter on the EMPTY FIRST paragraph of a loose list item
// (one that holds more than one paragraph) must not strip every paragraph out
// of the list item. `_enterInListItem`'s "empty paragraph, not only child"
// branch moved every paragraph from the caret's index to the end into a new
// sibling list item; when the caret sat on the first paragraph (index 0) that
// emptied the original list item, leaving a `list-item` with zero children.
//
// An empty list item has no content descendant, so
// `previousContentInContext()`/`nextContentInContext()` return null when arrow
// navigation tries to cross it — the symptom reported in #4644 where Up arrow
// can no longer move the caret up a line.

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

// A loose bullet list whose single list item holds two paragraphs: an empty
// first paragraph followed by `tail`.
const LOOSE_ITEM_STATE: TState[] = [
    {
        name: 'bullet-list',
        meta: { loose: true, marker: '*' },
        children: [
            {
                name: 'list-item',
                children: [
                    { name: 'paragraph', text: '' },
                    { name: 'paragraph', text: 'tail' },
                ],
            },
        ],
    },
] as unknown as TState[];

function bootMuya(content: TState[]): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {} as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    muya.setContent(content);
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

function enterAt(muya: Muya, content: Content, offset: number) {
    muya.editor.activeContentBlock = content;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        shiftKey: false,
        key: 'Enter',
    } as unknown as KeyboardEvent;
    content.enterHandler(event);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

interface IListItemLike { name: string; children?: unknown[] }

describe('#4644 enter on empty first paragraph of a multi-paragraph list item', () => {
    it('never produces a list-item with zero content children', async () => {
        const muya = bootMuya(LOOSE_ITEM_STATE);
        const emptyFirst = contentByText(muya, '');

        enterAt(muya, emptyFirst, 0);
        await flush();

        const state = muya.getState();
        const list = state[0] as { children: IListItemLike[] };
        for (const item of list.children) {
            expect(item.name).toBe('list-item');
            expect(item.children && item.children.length).toBeGreaterThan(0);
        }
    });

    it('splits into two non-empty list items (empty stays, tail moves down)', async () => {
        const muya = bootMuya(LOOSE_ITEM_STATE);
        const emptyFirst = contentByText(muya, '');

        enterAt(muya, emptyFirst, 0);
        await flush();

        const state = muya.getState();
        const list = state[0] as { children: { children: { name: string; text: string }[] }[] };
        expect(list.children.length).toBe(2);
        expect(list.children[0].children.map(p => p.text)).toEqual(['']);
        expect(list.children[1].children.map(p => p.text)).toEqual(['tail']);
    });
});
