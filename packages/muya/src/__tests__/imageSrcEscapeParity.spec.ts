// @vitest-environment happy-dom

import type Format from '../block/base/format';
import type { IImageInfo } from '../utils/image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pasteImageSrc } from '../clipboard/pasteImage';
import { tokenizer } from '../inline/lexer';
import { Muya } from '../muya';

// These callers must agree on local-path encoding even though HTTP insertion
// also URI-encodes its input. Mutations flush on the next animation frame.

const RAW_SRC = '/my photos/a#b.png';
const ESCAPED_SRC = '/my%20photos/a%23b.png';

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

function placeCursorOnFirstBlock(muya: Muya, offset = 0): Format {
    const first = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    first.setCursor(offset, offset, true);
    muya.editor.activeContentBlock = first;
    return first;
}

// Pull the `(...)` target out of the first `![alt](src)` in the serialized markdown.
function srcFromMarkdown(markdown: string): string {
    const match = /!\[[^\]]*\]\(([^)]*)\)/.exec(markdown);
    if (!match)
        throw new Error(`no inline image found in markdown: ${JSON.stringify(markdown)}`);
    return match[1];
}

// Drive each path on a freshly booted engine and return the escaped src it produced.

async function viaInsertImage(src = RAW_SRC): Promise<string> {
    const muya = bootMuya('\n');
    placeCursorOnFirstBlock(muya, 0);
    muya.insertImage({ src, alt: 'pic' });
    let destination = '';
    await vi.waitFor(() => {
        destination = srcFromMarkdown(muya.getMarkdown());
        expect(destination).not.toBe('');
    });
    return destination;
}

async function viaClipboardPaste(src = RAW_SRC): Promise<string> {
    const muya = bootMuya('\n');
    placeCursorOnFirstBlock(muya, 0);
    await pasteImageSrc(muya.editor.clipboard, src);
    let destination = '';
    await vi.waitFor(() => {
        destination = srcFromMarkdown(muya.getMarkdown());
        expect(destination).not.toBe('');
    });
    return destination;
}

async function viaReplaceImage(src = RAW_SRC): Promise<string> {
    // Boot with an existing image so replaceImage has a real token + range to
    // splice over (the image-edit-tool confirm path).
    const muya = bootMuya('![old](/old.png)\n');
    const block = placeCursorOnFirstBlock(muya, 0);
    const token = tokenizer(block.text)[0];
    const imageInfo = { token, imageId: 'id' } as unknown as IImageInfo;
    block.replaceImage(imageInfo, { alt: 'pic', src, title: '' });
    let destination = '';
    await vi.waitFor(() => {
        destination = srcFromMarkdown(muya.getMarkdown());
        expect(destination).not.toBe('/old.png');
    });
    return destination;
}

describe('image src escaping parity', () => {
    it('replaceImage percent-encodes spaces (%20) and # (%23)', async () => {
        const src = await viaReplaceImage();
        expect(src).toBe(ESCAPED_SRC);
    });

    it('insertImage percent-encodes spaces (%20) and # (%23)', async () => {
        const src = await viaInsertImage();
        expect(src).toBe(ESCAPED_SRC);
    });

    it('clipboard paste percent-encodes spaces (%20) and # (%23)', async () => {
        const src = await viaClipboardPaste();
        expect(src).toBe(ESCAPED_SRC);
    });

    it('preserves literal entity text across insertion, clipboard paste and replacement', async () => {
        const src = '/tmp/a&copy;.png';
        for (const insert of [viaInsertImage, viaClipboardPaste, viaReplaceImage]) {
            const destination = await insert(src);
            expect(tokenizer(`![pic](${destination})`)[0]).toMatchObject({ attrs: { src } });
        }
    });

    it('insertImage / clipboard paste / replaceImage produce byte-identical escaped src', async () => {
        const [insertImageSrc, pasteSrc, replaceImageSrc] = await Promise.all([
            viaInsertImage(),
            viaClipboardPaste(),
            viaReplaceImage(),
        ]);

        expect(insertImageSrc).toBe(ESCAPED_SRC);
        expect(pasteSrc).toBe(insertImageSrc);
        expect(replaceImageSrc).toBe(insertImageSrc);
    });
});
