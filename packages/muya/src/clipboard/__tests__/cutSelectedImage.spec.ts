// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import type { ImageToken } from '../../inlineRenderer/types';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';

// Cutting a selected inline image removes it from the document (muyajs parity).

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

// The same selection payload the click handler produces; range spans the whole
// `![..](..)` markdown.
function selectImage(muya: Muya): Format {
    const block = muya.editor.scrollPage!.firstContentInDescendant() as Format;
    const raw = block.text;
    const token = {
        type: 'image',
        raw,
        range: { start: 0, end: raw.length },
    } as unknown as ImageToken;
    muya.editor.selection.selectImage({ token, imageId: 'cut-img', block });
    return block;
}

describe('track C — cut a selected inline image deletes it (muyajs parity)', () => {
    it('cutHandler removes the selected image from the document', async () => {
        const muya = bootMuya('![alt](https://example.com/a.png)\n');
        selectImage(muya);
        expect(muya.editor.selection.image).not.toBeNull();

        muya.editor.clipboard.cutHandler();
        await new Promise(r => setTimeout(r, 40));

        expect(muya.getMarkdown()).toBe('\n');
        expect(muya.editor.selection.image).toBeNull();
    });

    it('cutting an image among text only removes the image markdown', async () => {
        const muya = bootMuya('before ![alt](https://example.com/a.png) after\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant() as Format;
        const raw = block.text;
        const start = raw.indexOf('![');
        const end = raw.indexOf(')', start) + 1;
        const token = {
            type: 'image',
            raw: raw.slice(start, end),
            range: { start, end },
        } as unknown as ImageToken;
        muya.editor.selection.selectImage({ token, imageId: 'cut-img', block });

        muya.editor.clipboard.cutHandler();
        await new Promise(r => setTimeout(r, 40));

        expect(muya.getMarkdown()).toBe('before  after\n');
        expect(muya.editor.selection.image).toBeNull();
    });
});
