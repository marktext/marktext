// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

// #3202: a double click on an image should open the host's full-size preview.
// `_handleClickInlineImage` calls `preventDefault()` before anything else, and
// Blink suppresses the `dblclick` event when the click's default is prevented,
// so the double click is recognised from the click event's own `detail` count
// and routed to the existing `preview-image` event (the one Space-on-a-selected
// -image already emits, and the one the desktop renderer already subscribes to).

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

function click(img: HTMLImageElement, detail: number, init: MouseEventInit = {}): void {
    img.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true, detail, ...init }),
    );
}

// A real double click arrives as two clicks with detail 1 then 2. The first
// click selects the image and re-renders the block; under happy-dom the async
// image load never resolves, so the injected <img> is detached and not
// re-created. Inject it again before the second click to stand in for the
// loaded image a real browser would have.
function dblClick(muya: Muya, src: string, init: MouseEventInit = {}): void {
    click(injectImg(muya, src), 1, init);
    click(injectImg(muya, src), 2, init);
}

function capturePreviews(muya: Muya): unknown[] {
    const payloads: unknown[] = [];
    muya.on('preview-image', (payload: unknown) => payloads.push(payload));
    return payloads;
}

function captureFormatClickTypes(muya: Muya): string[] {
    const types: string[] = [];
    muya.eventCenter.on('format-click', (payload: { formatType?: string }) => {
        if (payload && payload.formatType)
            types.push(payload.formatType);
    });
    return types;
}

describe('double click previews an image (#3202)', () => {
    it('emits preview-image once, carrying the image src', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![alt](${src})`);
        const previews = capturePreviews(muya);

        dblClick(muya, src);

        expect(previews).toHaveLength(1);
        expect(JSON.stringify(previews[0])).toContain(src);
    });

    it('does not emit preview-image for the first click of the pair', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![alt](${src})`);
        const img = injectImg(muya, src);
        const previews = capturePreviews(muya);

        click(img, 1);

        expect(previews).toHaveLength(0);
    });

    it('leaves the modifier-click path as the single preview trigger', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![alt](${src})`);
        const previews = capturePreviews(muya);
        const types = captureFormatClickTypes(muya);

        dblClick(muya, src, { ctrlKey: true });

        // Ctrl/Cmd-click already opens the viewer through format-click; emitting
        // preview-image as well would make the host tear down and rebuild it.
        expect(previews).toHaveLength(0);
        expect(types).toContain('image');
    });

    it('previews a linked image, whose navigation needs a modifier', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`[![alt](${src})](https://link.example.com)`);

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        expect(wrapper.closest(`.${CLASS_NAMES.MU_LINK}`)).not.toBeNull();

        const previews = capturePreviews(muya);
        const onFormatClick = vi.fn();
        muya.eventCenter.on('format-click', onFormatClick);

        dblClick(muya, src);

        // The #3835 guard only suppresses the preview for a *modifier*-click,
        // where the link is actually being followed. A plain double click does
        // not navigate, so there is nothing to conflict with.
        expect(previews).toHaveLength(1);
        expect(onFormatClick).not.toHaveBeenCalled();
    });
});
