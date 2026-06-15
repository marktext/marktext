// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// ENTER-SPLIT GUARD — pressing Enter mid-paragraph splits the block in two.
//
// `ParagraphContent.enterHandler` routes a plain (non-shift) Enter on a
// top-level paragraph through `_enterConvert`, which — when the text is not a
// block-conversion trigger — falls through to `Format.enterHandler`. That base
// handler keeps the text BEFORE the caret on the original block, moves the text
// AFTER the caret onto a freshly inserted sibling paragraph, and drops the
// caret at offset 0 of the new block. These characterization tests drive the
// handler the way the keydown listener does and assert the resulting document
// state after the json1 op flushes on the next frame.

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

// Find the leaf `.content` block whose rendered text matches `text`, the way a
// click resolves the active content block.
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

// Land the caret at `offset` of the given content block (active block + cursor),
// then route an Enter through its handler the way the keydown listener does.
function enterAt(muya: Muya, content: Content, offset: number): { preventDefault: ReturnType<typeof vi.fn> } {
    muya.editor.activeContentBlock = content;
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

// `getState()` returns a discriminated `TState` union; only some variants carry
// `text`. The blocks asserted here are paragraphs, so narrow to read it.
function blockText(state: ReturnType<Muya['getState']>, index: number): string {
    return (state[index] as { text: string }).text;
}

describe('enter mid-paragraph — split into two paragraphs', () => {
    it('keeps `hello` on the first block and moves ` world` onto the new block', async () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        enterAt(muya, content, 5);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(2);
        expect(state[0].name).toBe('paragraph');
        expect(state[1].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('hello');
        expect(blockText(state, 1)).toBe(' world');
    });

    it('lands the caret at offset 0 of the new (second) block', async () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        enterAt(muya, content, 5);

        await flush();
        const newBlock = contentByText(muya, ' world');
        const cursor = newBlock.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
    });

    it('calls preventDefault so the browser cannot also insert a native newline', () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        const event = enterAt(muya, content, 5);

        expect(event.preventDefault).toHaveBeenCalled();
    });
});

describe('enter at offset 0 — all text moves to the new block', () => {
    it('leaves the first block empty and carries the whole text onto the second', async () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        enterAt(muya, content, 0);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(2);
        expect(state[0].name).toBe('paragraph');
        expect(state[1].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('');
        expect(blockText(state, 1)).toBe('hello world');
    });

    it('lands the caret at offset 0 of the new block holding the text', async () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        enterAt(muya, content, 0);

        await flush();
        const newBlock = contentByText(muya, 'hello world');
        const cursor = newBlock.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
    });
});

describe('enter at end-of-text — appends an empty paragraph with the caret in it', () => {
    it('keeps the full text on the first block and adds an empty second block', async () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        enterAt(muya, content, content.text.length);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(2);
        expect(state[0].name).toBe('paragraph');
        expect(state[1].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('hello world');
        expect(blockText(state, 1)).toBe('');
    });

    it('lands the caret at offset 0 of the new empty block', async () => {
        const muya = bootMuya('hello world\n');
        const content = contentByText(muya, 'hello world');

        enterAt(muya, content, content.text.length);

        await flush();
        const state = muya.getState();
        expect(blockText(state, 1)).toBe('');
        const empty = contentByText(muya, '');
        const cursor = empty.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
    });
});
