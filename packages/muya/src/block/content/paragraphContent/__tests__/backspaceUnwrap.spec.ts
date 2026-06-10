// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// DATA-LOSS GUARD — backspace-at-offset-0 block surgery.
//
// Pressing Backspace at the very start of a paragraph either MERGES it onto the
// previous block or UNWRAPS it out of its container (block-quote / list). The
// migration audit flagged these cross-block paths as untested even though a
// miscount here drops or duplicates user content. `ParagraphContent`'s four
// branches are driven directly here (the handler reads the caret offset and the
// active block, the way a real Backspace keystroke routes through it), with the
// resulting document state asserted after the json1 op flushes on the next
// frame.

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

// Land the caret at offset 0 of the given content block (active block + cursor),
// then route a Backspace through its handler the way the keydown listener does.
function backspaceAtStart(muya: Muya, content: Content): void {
    muya.editor.activeContentBlock = content;
    content.setCursor(0, 0, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Backspace',
    } as unknown as KeyboardEvent;
    content.backspaceHandler(event);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

// `getState()` returns a discriminated `TState` union; only some variants carry
// `text`. The blocks asserted here are paragraphs, so narrow to read it.
function blockText(state: ReturnType<Muya['getState']>, index: number): string {
    return (state[index] as { text: string }).text;
}

describe('backspace at start-of-paragraph — merge with previous block', () => {
    it('merges `beta` onto the end of `alpha` into a single paragraph', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        backspaceAtStart(muya, beta);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('alphabeta');
    });

    it('lands the caret at the join point (end of the former first paragraph)', () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        backspaceAtStart(muya, beta);

        // After the merge the active block is `alpha`'s content; the caret sits
        // at offset 5 (the original `alpha` length), where the two joined.
        const merged = contentByText(muya, 'alphabeta');
        const cursor = merged.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(5);
    });

    it('is a no-op for the first paragraph in the document (no previous block)', async () => {
        const muya = bootMuya('only\n');
        const only = contentByText(muya, 'only');

        backspaceAtStart(muya, only);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(blockText(state, 0)).toBe('only');
    });
});

describe('backspace at start-of-paragraph — unwrap block-quote / list', () => {
    it('unwraps an only-child quote paragraph out of the block-quote', async () => {
        const muya = bootMuya('> quoted\n');
        const quoted = contentByText(muya, 'quoted');

        backspaceAtStart(muya, quoted);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('quoted');
    });

    it('unwraps an only/first list item out of the list to a paragraph', async () => {
        const muya = bootMuya('- item one\n');
        const item = contentByText(muya, 'item one');

        backspaceAtStart(muya, item);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('item one');
    });

    it('keeps the remaining items when the FIRST of several list items is unwrapped', async () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        const first = contentByText(muya, 'one');

        backspaceAtStart(muya, first);

        await flush();
        const md = muya.getMarkdown();
        // `one` lifts out to a leading paragraph; `two` and `three` stay in the
        // list — nothing is dropped.
        expect(md).toContain('one');
        expect(md).toContain('two');
        expect(md).toContain('three');
        const state = muya.getState();
        expect(state[0].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('one');
        expect(state[1].name).toBe('bullet-list');
    });

    it('merges a MIDDLE list item into the previous item, preserving all text', async () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        const two = contentByText(muya, 'two');

        backspaceAtStart(muya, two);

        await flush();
        const md = muya.getMarkdown();
        // The whole document stays a single bullet list; `two` is absorbed into
        // the previous item rather than dropped.
        expect(md).toContain('one');
        expect(md).toContain('two');
        expect(md).toContain('three');
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('bullet-list');
    });
});
