// @vitest-environment happy-dom

import type Content from '../content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { Muya } from '../../../muya';

// Backspace deletes a whole image as a unit (matching muyajs).
//
// Inline images (`![]()` and raw `<img>`) render as a `contenteditable=false`
// `.mu-inline-image` wrapper: the first Backspace right after one SELECTS it,
// the second (handled by ImageSelection) deletes it. Reference images
// (`![alt][ref]`) are editable marked text with no wrapper, so one Backspace
// removes the whole token.
//
// Two happy-dom fixups mirror real browsers: the async image load never
// resolves, so the loaded `<img>` is injected by hand (as in
// `selection/__tests__/parityPreviewImage.spec.ts`); and `setCursor` collapses
// a caret-after-image to the wrapper rather than into the image container, so
// for the "caret sits after the image" case the Range is placed by hand at the
// container position a real browser produces.

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

function firstContent(muya: Muya): Content {
    return muya.editor.scrollPage!.firstContentInDescendant() as unknown as Content;
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

function backspace(content: Content): void {
    content.backspaceHandler({
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        key: 'Backspace',
    } as unknown as KeyboardEvent);
}

// Inject the loaded <img> the renderer would have produced, then park the caret
// inside the image container after the <img> — the position a real browser
// leaves when the caret sits right after a trailing inline image.
function caretAfterInlineImage(muya: Muya): Content {
    const content = firstContent(muya);
    const wrapper = muya.domNode.querySelector<HTMLElement>(
        `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
    )!;
    const container = wrapper.querySelector<HTMLElement>(
        `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
    )!;
    if (!container.querySelector('img'))
        container.appendChild(document.createElement('img'));

    muya.editor.activeContentBlock = content;
    const range = document.createRange();
    range.setStart(container, container.childNodes.length);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    return content;
}

describe('backspace deletes a whole image', () => {
    it('a markdown image: first Backspace selects, second deletes', async () => {
        const muya = bootMuya('![alt](https://example.com/a.png)');
        const content = caretAfterInlineImage(muya);

        backspace(content);
        expect(muya.editor.selection.type).toBe('image');
        expect(muya.editor.selection.image?.token.range).toEqual({ start: 0, end: content.text.length });
        expect(muya.getMarkdown()).toContain('![alt](https://example.com/a.png)');

        // ImageSelection's document keydown listener deletes the selected image.
        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
        );
        await flush();
        expect(muya.getMarkdown()).not.toContain('![alt]');
    });

    it('a raw html <img>: first Backspace selects, second deletes', async () => {
        const muya = bootMuya('<img src="https://example.com/a.png" alt="raw">');
        const content = caretAfterInlineImage(muya);

        backspace(content);
        expect(muya.editor.selection.type).toBe('image');
        expect(muya.editor.selection.image).toBeTruthy();

        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
        );
        await flush();
        expect(muya.getMarkdown()).not.toContain('<img');
    });

    it('an image with text before it: Backspace selects once the following text is gone', async () => {
        // `foo![]()` with the caret parked on the (now trailing) image wrapper —
        // the position the browser leaves after deleting the text that followed
        // the image (`foo![]()bar` → delete `bar`). Reported via the wrapper, not
        // the container, so the offset reads as the image's start.
        const muya = bootMuya('foo![alt](https://example.com/a.png)');
        const content = firstContent(muya);
        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        wrapper
            .querySelector<HTMLElement>(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`)!
            .appendChild(document.createElement('img'));
        muya.editor.activeContentBlock = content;
        const range = document.createRange();
        range.setStart(wrapper, 0);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        backspace(content);
        expect(muya.editor.selection.type).toBe('image');

        document.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }),
        );
        await flush();
        const md = muya.getMarkdown();
        expect(md).not.toContain('![alt]');
        expect(md).toContain('foo');
    });

    it('a reference image: one Backspace removes the whole token, keeping the definition', async () => {
        const muya = bootMuya('![alt][ref]\n\n[ref]: https://example.com/a.png');
        const content = firstContent(muya);
        muya.editor.activeContentBlock = content;
        content.setCursor(content.text.length, content.text.length, true);

        backspace(content);
        await flush();
        expect(muya.getMarkdown()).not.toContain('![alt][ref]');
        expect(muya.getMarkdown()).toContain('[ref]: https://example.com/a.png');
    });
});
