// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// Pressing Backspace/Delete while an IME composition is active (e.g. deleting
// pre-commit pinyin characters inside an HTML block's closing tag) must reach
// the IME, not run the editor's backspaceHandler/deleteHandler. keydownHandler
// already guards Enter, the arrow keys and Tab with `!isComposed`; Backspace
// and Delete were missing the same guard, so CodeBlockContent.backspaceHandler
// ran mid-composition against a stale `this.text` and dislocated the cursor

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
    if (hadVersion) {
        window.MUYA_VERSION = originalVersion as string;
    }
    else {
        delete (window as Partial<Window>).MUYA_VERSION;
    }
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

function press(content: Format, key: string): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    content.keydownHandler(event);
    return event;
}

describe('backspace/delete during IME composition', () => {
    it('does not run backspaceHandler while composing — Backspace is left to the IME', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(5, 5);
        content.composeHandler(new Event('compositionstart'));
        const backspaceHandler = vi.spyOn(content, 'backspaceHandler');

        const event = press(content, 'Backspace');

        expect(backspaceHandler).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        expect(content.text).toBe('hello');
    });

    it('does not run deleteHandler while composing — Delete is left to the IME', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(0, 0);
        content.composeHandler(new Event('compositionstart'));
        const deleteHandler = vi.spyOn(content, 'deleteHandler');

        const event = press(content, 'Delete');

        expect(deleteHandler).not.toHaveBeenCalled();
        expect(event.defaultPrevented).toBe(false);
        expect(content.text).toBe('hello');
    });

    it('runs backspaceHandler normally when not composing', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(5, 5);
        const backspaceHandler = vi.spyOn(content, 'backspaceHandler');

        press(content, 'Backspace');

        expect(backspaceHandler).toHaveBeenCalled();
    });

    it('runs deleteHandler normally when not composing', () => {
        const muya = bootMuya('hello\n');
        const content = firstBlock(muya);
        content.setCursor(0, 0);
        const deleteHandler = vi.spyOn(content, 'deleteHandler');

        press(content, 'Delete');

        expect(deleteHandler).toHaveBeenCalled();
    });
});
