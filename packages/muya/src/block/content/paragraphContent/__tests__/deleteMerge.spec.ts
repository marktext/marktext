// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

// DATA-LOSS GUARD — forward-Delete-at-end-of-paragraph block merge.
//
// Pressing Delete at the very end of a paragraph appends the NEXT paragraph onto
// it and removes the now-empty next block. The handler performs that merge in the
// model itself, so it MUST call `event.preventDefault()` — otherwise the browser
// also runs its native forward-delete on the freshly merged paragraph, eating the
// first character of the appended text (`alpha` + `beta` -> `alphaeta`). The
// preventDefault assertion below is the regression guard for that drop.

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

// Land the caret at the end of the given content block (active block + cursor),
// then route a Delete through its handler the way the keydown listener does.
function deleteAtEnd(muya: Muya, content: Content): { preventDefault: ReturnType<typeof vi.fn> } {
    muya.editor.activeContentBlock = content;
    const offset = content.text.length;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Delete',
    } as unknown as KeyboardEvent & { preventDefault: ReturnType<typeof vi.fn> };
    content.deleteHandler(event);
    return event;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function blockText(state: ReturnType<Muya['getState']>, index: number): string {
    return (state[index] as { text: string }).text;
}

describe('forward Delete at end-of-paragraph — merge with next block', () => {
    it('appends `beta` onto the end of `alpha` into a single paragraph', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        deleteAtEnd(muya, alpha);

        await flush();
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('paragraph');
        expect(blockText(state, 0)).toBe('alphabeta');
    });

    it('calls preventDefault so the native delete cannot drop the first appended char', () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        const event = deleteAtEnd(muya, alpha);

        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('lands the caret at the join point (end of the former first paragraph)', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        deleteAtEnd(muya, alpha);

        await flush();
        const merged = contentByText(muya, 'alphabeta');
        const cursor = merged.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(5);
    });
});
