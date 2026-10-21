// @vitest-environment happy-dom

import type Content from '../content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import { isDocumentBoundaryArrow } from '../content';

// #3452 — muya's part in macOS ⌘↑/⌘↓ navigation is to refuse the key: the system
// binding moves the caret and the engine adopts it on keyup (the e2e spec covers
// that end-to-end). `isOsx` is a module-level const, so the file boots with a
// macOS-shaped config; the helper's `osx` argument covers the other platform.
vi.mock('../../../config', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../../config')>();
    return { ...actual, isOsx: true };
});

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

type FakeKeydownEvent = KeyboardEvent & {
    preventDefault: ReturnType<typeof vi.fn>;
    stopPropagation: ReturnType<typeof vi.fn>;
};

function keydownEvent(options: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): FakeKeydownEvent {
    return {
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        ...options,
    } as unknown as FakeKeydownEvent;
}

function pressKey(muya: Muya, content: Content, options: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean }): FakeKeydownEvent {
    muya.editor.activeContentBlock = content;
    const event = keydownEvent(options);
    content.keydownHandler(event);
    return event;
}

describe('isDocumentBoundaryArrow', () => {
    it('matches ⌘↑/⌘↓ on macOS', () => {
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowUp', metaKey: true }))).toBe(true);
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowDown', metaKey: true }))).toBe(true);
    });

    it('never matches off macOS', () => {
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowUp', metaKey: true }), false)).toBe(false);
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowDown', metaKey: true }), false)).toBe(false);
    });

    it('leaves plain arrows, other modifiers and other keys to muya', () => {
        const onMac = true;
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowUp' }), onMac)).toBe(false);
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowUp', metaKey: true, ctrlKey: true }), onMac)).toBe(false);
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowUp', metaKey: true, altKey: true }), onMac)).toBe(false);
        expect(isDocumentBoundaryArrow(keydownEvent({ key: 'ArrowLeft', metaKey: true }), onMac)).toBe(false);
    });
});

describe('content.keydownHandler — ⌘↑/⌘↓ reach the browser', () => {
    it('does not run the cross-block arrow handler for ⌘↑', () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');
        beta.setCursor(1, 1, true);
        const arrowHandler = vi.spyOn(beta, 'arrowHandler');

        const event = pressKey(muya, beta, { key: 'ArrowUp', metaKey: true });

        expect(arrowHandler).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
        expect(event.stopPropagation).not.toHaveBeenCalled();
    });

    it('does not run the cross-block arrow handler for ⌘↓', () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const alpha = contentByText(muya, 'alpha');
        alpha.setCursor(1, 1, true);
        const arrowHandler = vi.spyOn(alpha, 'arrowHandler');

        const event = pressKey(muya, alpha, { key: 'ArrowDown', metaKey: true });

        expect(arrowHandler).not.toHaveBeenCalled();
        expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('still navigates cross-block for the plain arrows', () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const beta = contentByText(muya, 'beta');
        beta.setCursor(1, 1, true);
        const arrowHandler = vi.spyOn(beta, 'arrowHandler');

        const event = pressKey(muya, beta, { key: 'ArrowUp' });

        expect(arrowHandler).toHaveBeenCalledTimes(1);
        expect(event.preventDefault).toHaveBeenCalled();
    });
});
