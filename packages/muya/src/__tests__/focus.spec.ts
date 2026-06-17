// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

// Focusing the editor must return the caret to where the user left it, not
// jump to the top of the document. The command palette blurs the editor
// (clearing activeContentBlock) and then re-focuses it before running a
// command; if focus() relocated to the first block, palette-only commands
// such as "Reset Paragraph" would operate on the wrong block.

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

describe('editor.focus()', () => {
    it('restores the last cursor block after a blur instead of jumping to the first block', () => {
        const muya = bootMuya('first\n\nsecond\n\nthird\n');
        const last = muya.editor.scrollPage!.lastContentInDescendant() as Content;
        last.setCursor(0, 0, true);
        expect(muya.editor.activeContentBlock).toBe(last);

        muya.blur();
        expect(muya.editor.activeContentBlock).toBeNull();

        muya.focus();
        expect(muya.editor.activeContentBlock).toBe(last);
    });

    it('falls back to the first block when there is no live prior selection', () => {
        const muya = bootMuya('alpha\n\nbeta\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant() as Content;

        muya.focus();
        expect(muya.editor.activeContentBlock).toBe(first);
    });
});
