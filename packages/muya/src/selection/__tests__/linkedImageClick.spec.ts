// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

// #3835: Ctrl/Cmd-clicking a linked image `[![alt](src)](href)` popped the
// image preview (ImageSelection's 'image' format-click) on top of the link
// navigation (linkMouseEvents' 'link' format-click), so the link appeared not
// to open. ImageSelection now skips emitting the image preview for an image
// that lives inside a link when the click carries a modifier.

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

// The async image load never resolves under happy-dom, so inject the <img> the
// loaded path would have produced.
function injectImg(muya: Muya, src: string): HTMLImageElement {
    const wrapper = muya.domNode.querySelector<HTMLElement>(
        `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
    )!;
    const container = wrapper.querySelector<HTMLElement>(
        `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
    )!;
    const img = document.createElement('img');
    img.setAttribute('src', src);
    container.appendChild(img);
    return img;
}

function ctrlClick(img: HTMLImageElement): void {
    img.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }),
    );
}

function captureFormatClickTypes(muya: Muya): string[] {
    const types: string[] = [];
    muya.eventCenter.on('format-click', (payload: { formatType?: string }) => {
        if (payload && payload.formatType)
            types.push(payload.formatType);
    });
    return types;
}

describe('linked image modifier-click does not pop the image preview (#3835)', () => {
    it('a linked image does not emit an image format-click on Ctrl-click', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`[![alt](${src})](https://link.example.com)`);

        // The image wrapper renders inside the link span; the fix keys off this.
        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper.closest(`.${CLASS_NAMES.MU_LINK}`)).not.toBeNull();

        const img = injectImg(muya, src);
        const types = captureFormatClickTypes(muya);

        ctrlClick(img);

        expect(types).not.toContain('image');
    });

    it('a plain (non-linked) image still emits an image format-click on Ctrl-click', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![alt](${src})`);

        const img = injectImg(muya, src);
        const types = captureFormatClickTypes(muya);

        ctrlClick(img);

        expect(types).toContain('image');
    });
});

// #4865: a reference-linked image `[![alt](src)][ref]` must render the image
// inside `a.mu-reference-link`, so the #3835 guard applies and Ctrl/Cmd-click
// follows the link. The inline tokenizer previously fragmented it into a bare
// image plus a separate empty reference link (its anchor group stopped at the
// image's inner `]`), leaving the image unwrapped.
describe('reference-linked image modifier-click follows the link (#4865)', () => {
    it('renders the image inside a.mu-reference-link and suppresses the image format-click', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`[![alt](${src})][ref]\n\n[ref]: https://link.example.com`);

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper).not.toBeNull();
        expect(wrapper.closest(`a.${CLASS_NAMES.MU_REFERENCE_LINK}`)).not.toBeNull();

        const img = injectImg(muya, src);
        const types = captureFormatClickTypes(muya);

        ctrlClick(img);

        expect(types).not.toContain('image');
    });
});
