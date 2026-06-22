// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #3223: Shift+Tab on a list item whose containing list is the FIRST child of
// an outer list item takes the REPLACEMENT path in `_unindentListItem`. That
// branch promoted the paragraph but — unlike the INDENT branch — never called
// setCursor, so the caret was left on the detached original block and lost.
// These tests boot real Muya, drive Shift+Tab through the handler, and assert
// the caret lands on the promoted paragraph.

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

function tabAt(muya: Muya, content: Content, offset: number, shiftKey = false): void {
    muya.editor.activeContentBlock = content;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Tab',
        shiftKey,
    } as unknown as KeyboardEvent;
    content.tabHandler(event);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('paragraphContent.tabHandler — Shift+Tab REPLACEMENT keeps the caret (#3223)', () => {
    // `- - A\n  - B\n`: the outer list item's first (and only) child is the
    // inner list [A, B], so `list.prev` is null -> REPLACEMENT path.
    it('promotes B and lands the caret on the promoted paragraph', async () => {
        const muya = bootMuya('- - A\n  - B\n');
        const b = contentByText(muya, 'B');

        tabAt(muya, b, 1, true);

        await flush();

        const promoted = contentByText(muya, 'B');
        const cursor = promoted.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(1);
        // The promoted block is the active content block.
        expect(muya.editor.activeContentBlock).toBe(promoted);
    });
});
