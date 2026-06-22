// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// Regression: Format.checkNeedRender / blurHandler must not crash when the
// block is active but its selection has no anchor/focus. This happens after
// the image-preview path (select image -> Space opens SimpleImageViewer ->
// Esc): ImageSelection never seats a text caret, so the image's paragraph
// stays the active content block with a null selection. The next click fires
// blurHandler() on that paragraph; checkNeedRender() then dereferenced
// `anchor!.offset` / `focus!.offset` on an undefined cursor and threw
// "Cannot read properties of undefined (reading 'offset')".

interface IFormatBlock {
    checkNeedRender: () => boolean;
    blurHandler: () => void;
    setCursor: (start: number, end: number, needUpdate?: boolean) => void;
}

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    vi.restoreAllMocks();
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

function firstFormat(muya: Muya): IFormatBlock {
    return muya.editor.scrollPage!.firstContentInDescendant()! as unknown as IFormatBlock;
}

// Force the "active block, no selection" state the image-preview path leaves
// behind: `block.selection` is `muya.editor.selection`, so stubbing its
// anchor/focus getters is exactly what `checkNeedRender`'s default cursor reads.
function nullifySelection(muya: Muya): void {
    vi.spyOn(muya.editor.selection, 'anchor', 'get').mockReturnValue(null);
    vi.spyOn(muya.editor.selection, 'focus', 'get').mockReturnValue(null);
}

describe('format.checkNeedRender / blurHandler with a null selection', () => {
    it('blurHandler() does not throw when the active block has no selection', () => {
        const muya = bootMuya('a paragraph with **bold** text\n');
        const block = firstFormat(muya);
        nullifySelection(muya);

        expect(() => block.blurHandler()).not.toThrow();
    });

    it('checkNeedRender() returns false instead of dereferencing a null cursor', () => {
        const muya = bootMuya('hello **world**\n');
        const block = firstFormat(muya);
        nullifySelection(muya);

        expect(() => block.checkNeedRender()).not.toThrow();
        expect(block.checkNeedRender()).toBe(false);
    });

    it('still evaluates tokens when a real cursor sits inside inline markup', () => {
        const muya = bootMuya('**bold**\n');
        const block = firstFormat(muya);
        // Caret inside the strong run (adjacent to the leading `**`): the cursor
        // is next to the strong token, so a re-render is needed.
        block.setCursor(2, 2, true);

        expect(block.checkNeedRender()).toBe(true);
    });
});
