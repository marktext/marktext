// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for `muya.invalidateImageCache()` — the public API the desktop
// shell calls to force inline images to reload (e.g. after a watched image
// file changes on disk, or on the `mt::invalidate-image-cache` IPC).
//
// The inline renderer memoises loaded images in two maps keyed by src:
//   - `loadImageMap` (skipped on the next render once `isSuccess` is true)
//   - `urlMap` (resolved/inflight URLs)
// `invalidateImageCache()` clears both and re-renders every content block so
// `loadImageAsync` runs afresh. happy-dom's `Image` never fires load/error
// for a `file://` src, so we seed the caches by hand rather than relying on a
// real load resolving.

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

function renderer(muya: Muya) {
    return muya.editor.inlineRenderer.renderer;
}

describe('muya.invalidateImageCache()', () => {
    it('exposes the method on the Muya instance', () => {
        const muya = bootMuya('# hi');
        expect(typeof muya.invalidateImageCache).toBe('function');
    });

    it('clears the loadImageMap and urlMap caches', () => {
        const muya = bootMuya('![alt](/tmp/pic.png)');
        const { loadImageMap, urlMap } = renderer(muya);

        loadImageMap.set('file:///tmp/pic.png', {
            id: 'img-1',
            isSuccess: true,
            url: 'file:///tmp/pic.png',
            width: 320,
            height: 240,
        });
        urlMap.set('file:///tmp/pic.png', 'data:image/png;base64,AAAA');

        expect(loadImageMap.size).toBe(1);
        expect(urlMap.size).toBe(1);

        muya.invalidateImageCache();

        expect(loadImageMap.size).toBe(0);
        expect(urlMap.size).toBe(0);
    });

    it('re-renders content blocks so inline images load again', async () => {
        const muya = bootMuya('![alt](/tmp/pic.png)');
        const inlineRenderer = muya.editor.inlineRenderer;
        const { loadImageMap } = renderer(muya);

        loadImageMap.set('file:///tmp/pic.png', {
            id: 'img-1',
            isSuccess: true,
            url: 'file:///tmp/pic.png',
        });

        const patchSpy = vi.spyOn(inlineRenderer, 'patch');

        muya.invalidateImageCache();

        // The image cache is flushed synchronously...
        expect(loadImageMap.size).toBe(0);
        // ...and the content block carrying the image is re-patched, which
        // re-runs `loadImageAsync` for it.
        await vi.waitFor(() => {
            expect(patchSpy).toHaveBeenCalled();
        });

        patchSpy.mockRestore();
    });

    it('does not throw on a document with no images', () => {
        const muya = bootMuya('just a paragraph, no images here');
        expect(() => muya.invalidateImageCache()).not.toThrow();
        expect(renderer(muya).loadImageMap.size).toBe(0);
        expect(renderer(muya).urlMap.size).toBe(0);
    });

    it('does not throw on an empty document', () => {
        const muya = bootMuya('');
        expect(() => muya.invalidateImageCache()).not.toThrow();
    });
});
