// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

// #4865 (raw-HTML case): a raw-HTML linked image `<a href><img></a>` renders
// its `<a>` as a real anchor (`a.mu-raw-html`) — an image's hover icons used to
// be `<a>` elements, so nesting them produced invalid `<a>`-inside-`<a>` and the
// HTML parser hoisted the image out of the link. Icons are now `<span>`, so the
// image stays inside the anchor and Ctrl/Cmd-click follows the link.
//
// This runs under jsdom, NOT happy-dom: DOMPurify strips the `<a>` under
// happy-dom (the raw-HTML tag would render as a `<span>`, masking the anchor
// nesting the fix addresses). jsdom keeps it, matching the real Electron app.

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    (window as unknown as { MUYA_VERSION?: string }).MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as unknown as { MUYA_VERSION?: string }).MUYA_VERSION;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

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

function captureFormatClickTypes(muya: Muya): string[] {
    const types: string[] = [];
    muya.eventCenter.on('format-click', (payload: { formatType?: string }) => {
        if (payload && payload.formatType)
            types.push(payload.formatType);
    });
    return types;
}

describe('raw-HTML linked image modifier-click follows the link (#4865)', () => {
    it('renders the image inside a.mu-raw-html and suppresses the image format-click', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`<a href="https://link.example.com"><img src="${src}"></a>`);

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper).not.toBeNull();
        // The <a> is a real anchor; the image (and its container) must stay
        // inside it rather than being hoisted out by an invalid nested <a>.
        expect(wrapper.closest(`a.${CLASS_NAMES.MU_RAW_HTML}`)).not.toBeNull();
        expect(wrapper.querySelector(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`)).not.toBeNull();

        const img = injectImg(muya, src);
        const types = captureFormatClickTypes(muya);

        img.dispatchEvent(
            new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }),
        );

        expect(types).not.toContain('image');
    });
});
