// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import type { ImageToken } from '../../inlineRenderer/types';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// muyajs `pasteImage` replaces a selected inline image when an image is pasted,
// instead of inserting a second image at a (now collapsed) text cursor.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown, ...options } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function selectWholeImage(muya: Muya): Format {
    const block = muya.editor.scrollPage!.firstContentInDescendant() as Format;
    const raw = block.text;
    const token = {
        type: 'image',
        raw,
        range: { start: 0, end: raw.length },
    } as unknown as ImageToken;
    muya.editor.selection.selectImage({ token, imageId: 'sel-img', block });

    // happy-dom doesn't round-trip the range that `setCursor` writes, so stub
    // `getSelection` to the image's range — what a real browser would report
    // after the replace path selects the old image.
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: 0, block, path },
        focus: { offset: raw.length, block, path },
        isCollapsed: false,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
    return block;
}

function pasteEvent() {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: { getData: () => '', files: [], items: [] },
    } as unknown as ClipboardEvent;
}

describe('paste — replace a selected inline image (muyajs parity)', () => {
    it('pasting an image while one is selected replaces it', async () => {
        const muya = bootMuya('![old](https://example.com/old.png)\n', {
            clipboardFilePath: () => Promise.resolve('/tmp/new.png'),
        });
        selectWholeImage(muya);

        await muya.editor.clipboard.pasteHandler(pasteEvent(), '', '');
        await new Promise(r => setTimeout(r, 40));

        expect(muya.getMarkdown()).toBe('![](/tmp/new.png)\n');
    });

    it('replaces by the token range even when the DOM selection clamps to one position', async () => {
        // Real browsers collapse a text selection spanning the atomic
        // (contenteditable=false) image to a single position — this is what
        // broke replacing a resized `<img>`: the splice consumed only the
        // leading character and orphaned the rest of the tag. The replace must
        // use the image token's range, not the clamped DOM selection.
        const muya = bootMuya('![old](https://example.com/old.png)\n', {
            clipboardFilePath: () => Promise.resolve('/tmp/new.png'),
        });
        const block = muya.editor.scrollPage!.firstContentInDescendant() as Format;
        const raw = block.text;
        muya.editor.selection.selectImage({
            token: { type: 'image', raw, range: { start: 0, end: raw.length } } as unknown as ImageToken,
            imageId: 'sel-img',
            block,
        });
        const path = block.path;
        muya.editor.selection.getSelection = () => ({
            anchor: { offset: 0, block, path },
            focus: { offset: 1, block, path }, // clamped across the atomic image
            isCollapsed: false,
            isSelectionInSameBlock: true,
            direction: SelectionDirection.FORWARD,
            type: SelectionCaretType.RANGE,
        });

        await muya.editor.clipboard.pasteHandler(pasteEvent(), '', '');
        await new Promise(r => setTimeout(r, 40));

        // The WHOLE image is replaced, not just the first character.
        expect(muya.getMarkdown()).toBe('![](/tmp/new.png)\n');
    });

    it('leaves the replaced image selected so the toolbar / resize bar follow it', async () => {
        const muya = bootMuya('![old](https://example.com/old.png)\n', {
            clipboardFilePath: () => Promise.resolve('/tmp/new.png'),
        });
        selectWholeImage(muya);

        await muya.editor.clipboard.pasteHandler(pasteEvent(), '', '');
        await new Promise(r => setTimeout(r, 40));

        const selected = muya.editor.selection.image;
        expect(selected).not.toBeNull();
        expect(selected!.token.attrs.src).toContain('/tmp/new.png');
    });
});
