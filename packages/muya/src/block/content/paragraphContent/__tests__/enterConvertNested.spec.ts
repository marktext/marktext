// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// ENTER-CONVERT INSIDE CONTAINERS — pressing Enter on a paragraph whose text is
// a code-fence trigger (```` ```lang ````) must convert it to a fenced
// code-block IN PLACE, even when the paragraph lives inside a block-quote or a
// list item. The conversion replaces the paragraph node within its container,
// so the code-block stays nested (matching the legacy muyajs behaviour). Before
// this, the block-quote/list Enter handlers only split or unwrapped the
// paragraph and never reached `_enterConvert`, so ```` ```js ```` + Enter
// produced a plain paragraph instead of a code-block.

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

function enterWithText(muya: Muya, content: Content, text: string): { preventDefault: ReturnType<typeof vi.fn> } {
    muya.editor.activeContentBlock = content;
    content.text = text;
    content.update();
    const offset = content.text.length;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        shiftKey: false,
        key: 'Enter',
    } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
    content.enterHandler(event);
    return event;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

interface IStateNode {
    name: string;
    meta?: { lang?: string; type?: string };
    children?: IStateNode[];
}

describe('enter on ```` ```js ```` inside a block-quote — converts to a nested code-block', () => {
    it('replaces the paragraph with a code-block kept inside the block-quote', async () => {
        const muya = bootMuya('> seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```js');

        await flush();
        const state = muya.getState() as IStateNode[];
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('block-quote');
        const children = state[0].children!;
        expect(children.length).toBe(1);
        expect(children[0].name).toBe('code-block');
        expect(children[0].meta!.lang).toBe('js');
        expect(children[0].meta!.type).toBe('fenced');
    });
});

describe('enter on ```` ```js ```` inside a list item — converts to a nested code-block', () => {
    it('replaces the paragraph with a code-block kept inside the list item', async () => {
        const muya = bootMuya('- seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```js');

        await flush();
        const state = muya.getState() as IStateNode[];
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('bullet-list');
        const listItem = state[0].children![0];
        expect(listItem.name).toBe('list-item');
        expect(listItem.children!.length).toBe(1);
        expect(listItem.children![0].name).toBe('code-block');
        expect(listItem.children![0].meta!.lang).toBe('js');
    });
});

describe('enter on ```` ```mermaid ```` inside a block-quote — converts to a nested diagram', () => {
    it('replaces the paragraph with a diagram kept inside the block-quote', async () => {
        const muya = bootMuya('> seed\n');
        const content = contentByText(muya, 'seed');

        enterWithText(muya, content, '```mermaid');

        await flush();
        const state = muya.getState() as IStateNode[];
        expect(state[0].name).toBe('block-quote');
        const children = state[0].children!;
        expect(children.length).toBe(1);
        expect(children[0].name).toBe('diagram');
        expect(children[0].meta!.type).toBe('mermaid');
    });
});
