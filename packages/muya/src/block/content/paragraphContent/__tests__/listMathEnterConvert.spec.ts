// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// #2276 — inside a list item, typing `$$` then Enter should convert the item's
// paragraph into a math block IN PLACE (like a code fence already does), not
// split the item and leave behind an extra empty list entry. The enterHandler
// early-converts code fences even inside a list, but `$$` fell through to the
// list-split path, producing the math input AND an unwanted next list item.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

function keyEvent(over: Partial<KeyboardEvent> = {}): KeyboardEvent {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Enter',
        shiftKey: false,
        ...over,
    } as unknown as KeyboardEvent;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

// Drive `$$` + Enter on the list item's paragraph content and return the
// resulting top-level document state (the order-list).
async function enterDollarsInList(token: string): Promise<{ listChildren: number; itemBlockNames: string[] }> {
    const muya = bootMuya('1. x\n');
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Content;
    content.text = token;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(token.length, token.length, true);

    content.enterHandler(keyEvent({ key: 'Enter' }));
    await flush();

    const state = muya.getState() as Array<{ name: string; children?: Array<{ name: string; children?: Array<{ name: string }> }> }>;
    const list = state[0];
    const items = list.children ?? [];
    return {
        listChildren: items.length,
        itemBlockNames: (items[0]?.children ?? []).map(c => c.name),
    };
}

describe('#2276 — `$$`/code-fence + Enter inside a list converts in place, no extra item', () => {
    it('`$$` converts the list item to a math block without adding a new list item', async () => {
        const { listChildren, itemBlockNames } = await enterDollarsInList('$$');
        expect(listChildren).toBe(1); // no unwanted second list item
        expect(itemBlockNames).toContain('math-block');
    });

    it('a code fence ```` ``` ```` converts in place without adding a new list item', async () => {
        const { listChildren, itemBlockNames } = await enterDollarsInList('```js');
        expect(listChildren).toBe(1);
        expect(itemBlockNames).toContain('code-block');
    });

    it('a table `|a|b|` converts in place without adding a new list item', async () => {
        const { listChildren, itemBlockNames } = await enterDollarsInList('|a|b|');
        expect(listChildren).toBe(1);
        expect(itemBlockNames).toContain('table');
    });

    it('an HTML block `<div>` converts in place without adding a new list item', async () => {
        const { listChildren, itemBlockNames } = await enterDollarsInList('<div>');
        expect(listChildren).toBe(1);
        expect(itemBlockNames).toContain('html-block');
    });
});
