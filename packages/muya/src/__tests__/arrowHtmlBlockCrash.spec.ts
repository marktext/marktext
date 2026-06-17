// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

// Regression: pressing ArrowDown inside an HTML block's code content used to
// crash with "Cannot destructure property 'y' of getCursorCoords(...) as it is
// null". `getCursorCoords()` returns `DOMRect | null` (no client rects for the
// collapsed caret), but `getCursorYOffset` dereferenced it with a `!`.
// In happy-dom `Range.getClientRects()` always returns an empty list, so this
// reproduces the null-coords condition deterministically.

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

describe('arrowHandler from an HTML block (null cursor coords)', () => {
    it('does not throw on ArrowDown when getCursorCoords() returns null', () => {
        const muya = bootMuya('<div>html content</div>\n\nafter\n');
        const codeContent = muya.editor.scrollPage!.firstContentInDescendant()!;
        codeContent.setCursor(0, 0, true);

        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });

        expect(() => codeContent.arrowHandler(event)).not.toThrow();
    });
});
