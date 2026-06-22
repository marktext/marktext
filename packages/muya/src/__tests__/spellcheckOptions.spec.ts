// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../config';
import { Muya } from '../muya';

// `spellcheckEnabled` (native check + right-click suggestions) and
// `spellcheckHideMarks` (hide the squiggle only) must be INDEPENDENT engine
// options. Historically the desktop "no underline" preference reused
// `spellcheckEnabled`, so hiding the underline also disabled the native
// checker and killed context-menu suggestions. These assertions pin the
// decoupled behaviour: one toggles the container `spellcheck` attribute, the
// other toggles a container class, and neither touches the other.

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

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

describe('spellcheck options decoupling', () => {
    it('spellcheckEnabled only toggles the container spellcheck attribute', () => {
        const muya = bootMuya('helllo wrold\n');
        const node = muya.domNode;

        muya.setOptions({ spellcheckEnabled: true });
        expect(node.getAttribute('spellcheck')).toBe('true');
        expect(node.classList.contains(CLASS_NAMES.MU_HIDE_SPELLING_MARKS)).toBe(false);

        muya.setOptions({ spellcheckEnabled: false });
        expect(node.getAttribute('spellcheck')).toBe('false');
        expect(node.classList.contains(CLASS_NAMES.MU_HIDE_SPELLING_MARKS)).toBe(false);
    });

    it('spellcheckHideMarks only toggles the hide-marks class, never the spellcheck attribute', () => {
        const muya = bootMuya('helllo wrold\n');
        const node = muya.domNode;

        // Enable native checking first; hiding marks must not disturb it.
        muya.setOptions({ spellcheckEnabled: true });
        expect(node.getAttribute('spellcheck')).toBe('true');

        muya.setOptions({ spellcheckHideMarks: true });
        expect(node.classList.contains(CLASS_NAMES.MU_HIDE_SPELLING_MARKS)).toBe(true);
        // Native checker stays on => right-click suggestions still work.
        expect(node.getAttribute('spellcheck')).toBe('true');

        muya.setOptions({ spellcheckHideMarks: false });
        expect(node.classList.contains(CLASS_NAMES.MU_HIDE_SPELLING_MARKS)).toBe(false);
        expect(node.getAttribute('spellcheck')).toBe('true');
    });

    it('the two options compose for the "check but no underline" state', () => {
        const muya = bootMuya('helllo wrold\n');
        const node = muya.domNode;

        muya.setOptions({ spellcheckEnabled: true, spellcheckHideMarks: true });
        expect(node.getAttribute('spellcheck')).toBe('true');
        expect(node.classList.contains(CLASS_NAMES.MU_HIDE_SPELLING_MARKS)).toBe(true);
    });
});
