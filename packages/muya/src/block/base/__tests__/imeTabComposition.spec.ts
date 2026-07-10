// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// #1250 — pressing Tab while an IME composition is active (e.g. cycling
// Japanese candidates) must reach the IME, not run the editor's tabHandler.
// keydownHandler already guards Enter and the arrow keys with `!isComposed`;
// Tab was missing the same guard and inserted indentation mid-composition.

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

function firstBlock(muya: Muya): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    return content;
}

function pressTab(content: Format): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    content.keydownHandler(event);
    return event;
}

describe('tab during IME composition (#1250)', () => {
    it('does not run tabHandler while composing — Tab is left to the IME', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(0, 5);
        content.composeHandler(new Event('compositionstart'));
        const tabHandler = vi.spyOn(content, 'tabHandler');

        const event = pressTab(content);

        expect(tabHandler).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        expect(content.text).toBe('hello');
    });

    it('runs tabHandler normally when not composing', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(0, 5);
        const tabHandler = vi.spyOn(content, 'tabHandler');

        pressTab(content);

        expect(tabHandler).toHaveBeenCalled();
    });
});
