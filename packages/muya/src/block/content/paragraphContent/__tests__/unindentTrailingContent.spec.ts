// @vitest-environment happy-dom

import type { TState } from '../../../../state/types';
import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #4899: Shift+Tab on a nested list item whose list has trailing sibling
// blocks (`list.next`) appended those blocks — paragraphs — directly into the
// freshly created nested child list, without a list-item wrapper. The state
// became schema-invalid (a list whose child is a paragraph), and the next
// edit's composed op crashed ot-json1 with "Cannot use numerical key for
// object container". The trailing blocks are the outdented item's own
// content and must land in the new list item itself.

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

function shiftTabAt(muya: Muya, content: Content, offset: number): void {
    muya.editor.activeContentBlock = content;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Tab',
        shiftKey: true,
    } as unknown as KeyboardEvent;
    content.tabHandler(event);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

/** Every child of every list block must be a list item. */
function assertListsHoldOnlyItems(state: TState[]): void {
    for (const node of state) {
        if ('children' in node && Array.isArray(node.children)) {
            if (node.name === 'bullet-list' || node.name === 'order-list' || node.name === 'task-list') {
                for (const child of node.children) {
                    expect(
                        child.name,
                        `${node.name} child must be a list item, got ${child.name}`,
                    ).toMatch(/list-item$/);
                }
            }
            assertListsHoldOnlyItems(node.children as TState[]);
        }
    }
}

describe('paragraphContent — Shift+Tab INDENT with trailing content (#4899)', () => {
    // Outer item: [paragraph a, bullet-list [item b], paragraph c].
    // Outdenting b must carry the trailing paragraph c into the NEW item b as
    // plain content, not wrap it in a list.
    it('moves trailing paragraphs into the outdented item, not into a list', async () => {
        const muya = bootMuya('- a\n\n  - b\n\n  c\n');
        const b = contentByText(muya, 'b');

        shiftTabAt(muya, b, 1);
        await flush();
        muya.editor.jsonState.flush();

        const state = muya.getState();
        assertListsHoldOnlyItems(state);

        const md = muya.getMarkdown();
        // c stays indented under the outdented item b.
        expect(md).toMatch(/- b\n\n {2}c/);
    });

    // Both remaining sibling items AND trailing paragraphs: the siblings stay
    // in a nested child list, the paragraphs follow as item content.
    it('keeps sibling items nested while trailing paragraphs become item content', async () => {
        const muya = bootMuya('- a\n\n  - b\n\n  - d\n\n  c\n');
        const b = contentByText(muya, 'b');

        shiftTabAt(muya, b, 1);
        await flush();
        muya.editor.jsonState.flush();

        const state = muya.getState();
        assertListsHoldOnlyItems(state);

        const md = muya.getMarkdown();
        expect(md).toMatch(/- b\n\n {2}- d\n\n {2}c/);
    });
});
