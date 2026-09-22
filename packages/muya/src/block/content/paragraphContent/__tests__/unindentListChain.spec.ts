// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #5342: Shift+Tab only outdents when the caret paragraph really sits in a
// nested list item — `paragraph > list item > list > list item`. The unindent
// check used to look only at the paragraph's great-grandparent, so a paragraph
// in `list item > block-quote > block-quote` was "outdented": the inner quote
// was moved into the outer list and the outer quote was dropped.

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

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, ...options } as ConstructorParameters<typeof Muya>[1]);
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

function shiftTabAt(muya: Muya, text: string): KeyboardEvent {
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
    return event;
}

async function settle(muya: Muya): Promise<void> {
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    muya.editor.jsonState.flush();
}

describe('paragraphContent — Shift+Tab outside a nested list item is a no-op (#5342)', () => {
    const cases: Array<[name: string, markdown: string, target: string, options?: Record<string, unknown>]> = [
        ['two-level quote in a list item', '- a\n\n  > > q\n', 'q'],
        ['two-level quote in a task list item', '- [ ] a\n\n  > > q\n', 'q'],
        ['two-level quote in a nested list item', '- a\n  - b\n\n    > > q\n', 'q'],
        ['two-level quote in a list nested in a quote', '> - a\n>\n>   > > q\n', 'q'],
        ['footnote in a quote in a list item', '- a\n\n  > [^1]: note\n', 'note', { footnote: true }],
        ['single-level quote in a list item (already a no-op)', '- a\n\n  > q\n', 'q'],
    ];

    for (const [name, markdown, target, options] of cases) {
        it(name, async () => {
            const muya = bootMuya(markdown, options);
            const stateBefore = muya.getState();
            const markdownBefore = muya.getMarkdown();

            const event = shiftTabAt(muya, target);
            await settle(muya);

            expect(event.preventDefault).toHaveBeenCalled();
            expect(muya.getState()).toEqual(stateBefore);
            expect(muya.getMarkdown()).toBe(markdownBefore);
        });
    }
});

describe('paragraphContent — Shift+Tab still outdents nested list items', () => {
    const cases: Array<[name: string, markdown: string, target: string, expected: string]> = [
        ['nested bullet item (INDENT)', '- a\n  - b\n', 'b', '- a\n- b\n'],
        ['nested ordered item (INDENT)', '1. a\n   1. b\n', 'b', '1. a\n2. b\n'],
        ['nested task item (INDENT)', '- [ ] a\n  - [ ] b\n', 'b', '- [ ] a\n- [ ] b\n'],
        ['nested item with trailing paragraph (#4899)', '- a\n  - b\n\n  c\n', 'b', '- a\n\n- b\n\n  c\n'],
        ['nested list as the first child of an item (REPLACEMENT)', '- - b\n', 'b', '- b\n'],
    ];

    for (const [name, markdown, target, expected] of cases) {
        it(name, async () => {
            const muya = bootMuya(markdown);

            shiftTabAt(muya, target);
            await settle(muya);

            expect(muya.getMarkdown()).toBe(expected);
        });
    }
});
