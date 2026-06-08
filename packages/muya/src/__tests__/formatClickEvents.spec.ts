// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../config';
import { Muya } from '../muya';

// Coverage for the desktop-migration interaction events ported from legacy
// `packages/muyajs` (`clickCtrl.js` link path + `clickEvent.js` image path):
//
//   - `format-click` { event, formatType: 'link', data } on a Cmd/Ctrl-click
//     of a rendered link. `data` is the `getLinkInfo` payload (superset of
//     the legacy `{ text, href }`).
//   - `format-click` { event, formatType: 'image', data: <src> } on a
//     Cmd/Ctrl-click of a rendered <img>.
//
// The desktop renderer (`editor.vue`) re-checks the modifier and opens the
// link / image viewer; muya only emits, leaving the plain-click
// cursor-placement / image-toolbar behaviour untouched.

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

function dispatchClick(target: Element, init: MouseEventInit = {}): void {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init }));
}

describe('format-click on links', () => {
    it('emits format-click with the link payload on a Cmd/Ctrl-click', () => {
        const muya = bootMuya('[hello](https://example.com)');
        const link = muya.domNode.querySelector<HTMLElement>(`span.${CLASS_NAMES.MU_LINK}`)!;
        expect(link).toBeTruthy();

        const handler = vi.fn();
        muya.on('format-click', handler);

        dispatchClick(link, { metaKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0];
        expect(payload.formatType).toBe('link');
        expect(payload.event).toBeInstanceOf(MouseEvent);
        expect(payload.data.href).toBe('https://example.com');
        expect(payload.data.text).toBe('hello');
    });

    it('also fires for a Ctrl-click (non-macOS modifier)', () => {
        const muya = bootMuya('[hello](https://example.com)');
        const link = muya.domNode.querySelector<HTMLElement>(`span.${CLASS_NAMES.MU_LINK}`)!;

        const handler = vi.fn();
        muya.on('format-click', handler);

        dispatchClick(link, { ctrlKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].formatType).toBe('link');
    });

    it('does NOT emit format-click on a plain (no-modifier) link click', () => {
        const muya = bootMuya('[hello](https://example.com)');
        const link = muya.domNode.querySelector<HTMLElement>(`span.${CLASS_NAMES.MU_LINK}`)!;

        const handler = vi.fn();
        muya.on('format-click', handler);

        dispatchClick(link);

        expect(handler).not.toHaveBeenCalled();
    });
});

describe('format-click on images', () => {
    // Boot an image and inject a loaded <img> into the rendered container.
    // The async `loadImageAsync` path never resolves in happy-dom (no real
    // network / Image decode), so we stand in the <img> the renderer would
    // have produced and drive the click through the real handler.
    function bootImage(src: string): { muya: Muya; img: HTMLImageElement } {
        const muya = bootMuya(`![alt](${src})`);
        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        )!;
        const container = wrapper.querySelector<HTMLElement>(
            `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
        )!;
        const img = document.createElement('img');
        img.setAttribute('src', src);
        container.appendChild(img);
        return { muya, img };
    }

    it('emits format-click with the image src on a Cmd/Ctrl-click', () => {
        const src = 'https://example.com/x.png';
        const { muya, img } = bootImage(src);

        const handler = vi.fn();
        muya.on('format-click', handler);

        dispatchClick(img, { metaKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0];
        expect(payload.formatType).toBe('image');
        expect(payload.event).toBeInstanceOf(MouseEvent);
        expect(payload.data).toBe(src);
    });

    it('emits image format-click on a Ctrl-click (non-macOS modifier)', () => {
        const src = 'https://example.com/x.png';
        const { muya, img } = bootImage(src);

        const handler = vi.fn();
        muya.on('format-click', handler);

        dispatchClick(img, { ctrlKey: true });

        expect(handler).toHaveBeenCalledTimes(1);
        const payload = handler.mock.calls[0][0];
        expect(payload.formatType).toBe('image');
        expect(payload.data).toBe(src);
    });

    it('does NOT emit format-click on a plain (no-modifier) image click', () => {
        const { muya, img } = bootImage('https://example.com/x.png');

        const handler = vi.fn();
        muya.on('format-click', handler);

        dispatchClick(img);

        expect(handler).not.toHaveBeenCalled();
    });
});
