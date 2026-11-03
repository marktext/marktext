// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

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
    return muya.editor.inlineEngine.renderer;
}

describe('muya.invalidateImageCache()', () => {
    it('exposes the method on the Muya instance', () => {
        const muya = bootMuya('# hi');
        expect(typeof muya.invalidateImageCache).toBe('function');
    });

    it('invalidates pending resources and previews', () => {
        const muya = bootMuya('plain text');
        const { images } = renderer(muya);
        void images.request('file:///tmp/pic.png', false);
        muya.editor.inlineEngine.setImagePreview('file:///tmp/pic.png', 'data:image/png;base64,AAAA');
        expect(images.size).toBe(1);
        muya.invalidateImageCache();
        expect(images.size).toBe(0);
        expect(images.getPreview('file:///tmp/pic.png')).toBeUndefined();
    });

    it('re-renders content blocks so inline images load again', async () => {
        const muya = bootMuya('![alt](/tmp/pic.png)');
        const inlineEngine = muya.editor.inlineEngine;
        const patchSpy = vi.spyOn(inlineEngine, 'patch');

        muya.invalidateImageCache();

        // The image cache is flushed synchronously...
        expect(renderer(muya).images.get('file:///tmp/pic.png')).toBeUndefined();
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
        expect(renderer(muya).images.size).toBe(0);
    });

    it('does not throw on an empty document', () => {
        const muya = bootMuya('');
        expect(() => muya.invalidateImageCache()).not.toThrow();
    });
});
