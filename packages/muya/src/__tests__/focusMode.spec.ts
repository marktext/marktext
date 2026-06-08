// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

// Coverage for focus mode. marktext muyajs declared a `focusMode` option and
// reserved the `mu-focus-mode` class name but never applied it — focus mode was
// a complete no-op. `Muya#setFocusMode` now toggles `mu-focus-mode` on the
// editor container (and the constructor applies it when `focusMode: true` is
// passed), with the dimming itself driven by CSS in blockSyntax.css. These
// tests lock in the class-toggling contract; the visual dimming is verified by
// the e2e suite.

const FOCUS_MODE_CLASS = 'mu-focus-mode';

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

function bootMuya(options: Partial<ConstructorParameters<typeof Muya>[1]> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: '# heading\n\nparagraph A\n\nparagraph B\n', ...options } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('muya focus mode', () => {
    it('does not apply mu-focus-mode by default', () => {
        const muya = bootMuya();
        expect(muya.options.focusMode).toBe(false);
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(false);
    });

    it('applies mu-focus-mode at construction when focusMode: true', () => {
        const muya = bootMuya({ focusMode: true });
        expect(muya.options.focusMode).toBe(true);
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(true);
    });

    it('setFocusMode(false) removes the class and clears the option', () => {
        const muya = bootMuya({ focusMode: true });
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(true);

        muya.setFocusMode(false);
        expect(muya.options.focusMode).toBe(false);
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(false);
    });

    it('setFocusMode(true) adds the class and sets the option', () => {
        const muya = bootMuya();
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(false);

        muya.setFocusMode(true);
        expect(muya.options.focusMode).toBe(true);
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(true);
    });

    it('toggling is idempotent (re-adding keeps a single class)', () => {
        const muya = bootMuya();
        muya.setFocusMode(true);
        muya.setFocusMode(true);
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(true);

        muya.setFocusMode(false);
        muya.setFocusMode(false);
        expect(muya.domNode.classList.contains(FOCUS_MODE_CLASS)).toBe(false);
    });
});
