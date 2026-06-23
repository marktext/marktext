// @vitest-environment happy-dom

import type Content from '../content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// Cross-block arrow navigation over plain paragraphs — `Content.arrowHandler`.
//
// The migration audit flagged plain-paragraph cross-block navigation as
// untested: arrowHtmlBlockCrash.spec only guards null cursor-coords on HTML
// blocks, and tableCell/arrowHandler.spec only covers table cells. Neither
// pins the leaf paragraph offsets nor the trailing-empty-paragraph creation.
//
// In happy-dom the collapsed caret yields no client rects, so
// `Selection.getCursorYOffset` returns { topOffset: 0, bottomOffset: 0 } and the
// multi-line-protection early-return (content.ts L451-456) does NOT fire —
// cross-block navigation runs deterministically.

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

type FakeArrowEvent = KeyboardEvent & {
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
};

// Land the caret at `offset` of the given content block, mark it active, then
// route an Arrow key through its handler the way the keydown listener does.
function arrowAt(
    muya: Muya,
    content: Content,
    key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight',
    offset: number,
): FakeArrowEvent {
    muya.editor.activeContentBlock = content;
    content.setCursor(offset, offset, true);
    const event = {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key,
        shiftKey: false,
    } as unknown as FakeArrowEvent;
    content.arrowHandler(event);
    return event;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('content arrowHandler — cross-block navigation up', () => {
    it('arrowUp at offset 0 moves the caret to the END of the previous paragraph', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        const event = arrowAt(muya, beta, 'ArrowUp', 0);
        await flush();

        const alpha = contentByText(muya, 'alpha');
        const cursor = alpha.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe('alpha'.length);
        expect(cursor!.end.offset).toBe('alpha'.length);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('arrowLeft at offset 0 moves the caret to the END of the previous paragraph', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        const event = arrowAt(muya, beta, 'ArrowLeft', 0);
        await flush();

        const alpha = contentByText(muya, 'alpha');
        const cursor = alpha.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe('alpha'.length);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('arrowLeft in the MIDDLE of a block does not navigate cross-block', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        // offset 2 is mid-block; ArrowLeft should fall through to the browser.
        const event = arrowAt(muya, beta, 'ArrowLeft', 2);
        await flush();

        const alpha = contentByText(muya, 'alpha');
        expect(alpha.getCursor()).toBeNull();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });
});

describe('content arrowHandler — cross-block navigation down', () => {
    it('arrowDown at end of a paragraph moves the caret to offset 0 of the next paragraph', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        const event = arrowAt(muya, alpha, 'ArrowDown', 'alpha'.length);
        await flush();

        const beta = contentByText(muya, 'beta');
        const cursor = beta.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
        expect(cursor!.end.offset).toBe(0);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('arrowRight at offset === text.length moves the caret to offset 0 of the next paragraph', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        const event = arrowAt(muya, alpha, 'ArrowRight', 'alpha'.length);
        await flush();

        const beta = contentByText(muya, 'beta');
        const cursor = beta.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    it('arrowRight in the MIDDLE of a block does not navigate cross-block', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        // offset 2 is mid-block; ArrowRight should fall through to the browser.
        const event = arrowAt(muya, alpha, 'ArrowRight', 2);
        await flush();

        const beta = contentByText(muya, 'beta');
        expect(beta.getCursor()).toBeNull();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });
});

describe('content arrowHandler — trailing-paragraph creation at document end', () => {
    it('arrowDown at the end of the LAST block appends a new empty paragraph and lands the caret in it', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');
        const before = muya.getState();
        expect(before.length).toBe(2);

        const event = arrowAt(muya, beta, 'ArrowDown', 'beta'.length);
        await flush();

        const after = muya.getState();
        expect(after.length).toBe(before.length + 1);
        const last = after[after.length - 1] as { name: string; text: string };
        expect(last.name).toBe('paragraph');
        expect(last.text).toBe('');

        const appended = muya.editor.scrollPage!.lastContentInDescendant() as Content;
        const cursor = appended.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe(0);
        expect(cursor!.end.offset).toBe(0);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(event.stopPropagation).toHaveBeenCalled();
    });

    // #3520: pressing ArrowDown on an already-empty trailing paragraph must NOT
    // keep appending new empty paragraphs on every keypress. A trailing
    // paragraph is created only when the current (last) block has content.
    it('does not append another paragraph when ArrowDown is pressed in an already-empty trailing paragraph (#3520)', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        // First ArrowDown at the end of a non-empty last block appends one
        // trailing empty paragraph (existing, desired behavior).
        arrowAt(muya, beta, 'ArrowDown', 'beta'.length);
        await flush();
        expect(muya.getState().length).toBe(3);

        const appended = muya.editor.scrollPage!.lastContentInDescendant() as Content;
        expect(appended.text).toBe('');

        // Pressing ArrowDown again, now inside the empty trailing paragraph,
        // must NOT create a fourth block — the caret stays put.
        const event = arrowAt(muya, appended, 'ArrowDown', 0);
        await flush();

        expect(muya.getState().length).toBe(3);
        expect(appended.getCursor()).not.toBeNull();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('shiftKey held suppresses cross-block navigation (selection extend, not move)', async () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        muya.editor.activeContentBlock = alpha;
        alpha.setCursor('alpha'.length, 'alpha'.length, true);
        const event = {
            preventDefault: vi.fn(),
            stopPropagation: vi.fn(),
            key: 'ArrowDown',
            shiftKey: true,
        } as unknown as FakeArrowEvent;
        alpha.arrowHandler(event);
        await flush();

        // No navigation, no trailing-paragraph creation.
        expect(muya.getState().length).toBe(2);
        expect(contentByText(muya, 'beta').getCursor()).toBeNull();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});

// marktext #3568: in RTL mode the physical Left/Right arrows are visually
// mirrored, so the cross-block boundary keys must swap. Offset 0 is the visual
// RIGHT end of an RTL line (ArrowRight should go to the previous block); offset
// === text.length is the visual LEFT end (ArrowLeft should go to the next).
function bootMuyaRtl(markdown: string): Muya {
    const muya = bootMuya(markdown);
    muya.domNode.setAttribute('dir', 'rtl');
    return muya;
}

describe('content arrowHandler — RTL cross-block navigation (#3568)', () => {
    it('in RTL, ArrowRight at offset 0 moves the caret to the END of the previous paragraph', async () => {
        const muya = bootMuyaRtl('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        const event = arrowAt(muya, beta, 'ArrowRight', 0);
        await flush();

        const alpha = contentByText(muya, 'alpha');
        const cursor = alpha.getCursor();
        expect(cursor).not.toBeNull();
        expect(cursor!.start.offset).toBe('alpha'.length);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('in RTL, ArrowLeft at the end of a paragraph moves the caret to the next paragraph', async () => {
        const muya = bootMuyaRtl('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');

        const event = arrowAt(muya, alpha, 'ArrowLeft', 'alpha'.length);
        await flush();

        const beta = contentByText(muya, 'beta');
        expect(beta.getCursor()).not.toBeNull();
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('in RTL, ArrowLeft at offset 0 does NOT navigate cross-block', async () => {
        const muya = bootMuyaRtl('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');

        const event = arrowAt(muya, beta, 'ArrowLeft', 0);
        await flush();

        expect(contentByText(muya, 'alpha').getCursor()).toBeNull();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });
});
