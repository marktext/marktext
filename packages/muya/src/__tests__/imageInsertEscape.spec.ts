// @vitest-environment happy-dom

import type Format from '../block/base/format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { tokenizer } from '../inlineRenderer/lexer';
import { Muya } from '../muya';

// #3060 — an image whose file path contains a parenthesis must escape it, or the
// unbalanced `)` terminates the markdown image destination early (CommonMark:
// the destination ends at the first unbalanced `)`), truncating the path and
// spilling the tail into plain text. `insertImage` already percent-encodes
// spaces and `#`; parentheses belong to the same class.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

function insertImageAtStart(muya: Muya, src: string): Format {
    const block = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = block as never;
    block.setCursor(0, 0, true);
    muya.insertImage({ src });
    return block;
}

// Re-parse the block's markdown and return the single image token's destination,
// decoded back to a real path. A truncated `)` would split the image so either
// no image token is produced or its src stops short.
function roundTripImageSrc(text: string): string {
    const tokens = tokenizer(text, { options: {} as never });
    const image = tokens.find(t => t.type === 'image');
    if (!image)
        throw new Error(`no image token parsed from ${JSON.stringify(text)}`);
    return decodeURIComponent((image as { src: string }).src);
}

describe('insertImage escapes parentheses in the path (#3060)', () => {
    it('an unbalanced `)` in the path round-trips instead of truncating', () => {
        const muya = bootMuya('\n');
        const block = insertImageAtStart(muya, '/home/user/My Photos)/photo.png');
        expect(roundTripImageSrc(block.text)).toBe('/home/user/My Photos)/photo.png');
    });

    it('a `)` followed by a `(` round-trips', () => {
        const muya = bootMuya('\n');
        const block = insertImageAtStart(muya, '/a)b(c.png');
        expect(roundTripImageSrc(block.text)).toBe('/a)b(c.png');
    });

    it('still encodes spaces and keeps balanced parens loadable', () => {
        const muya = bootMuya('\n');
        const block = insertImageAtStart(muya, '/a (b)/c.png');
        expect(roundTripImageSrc(block.text)).toBe('/a (b)/c.png');
    });
});
