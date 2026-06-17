// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

// Regression: two images that share the same src render with a cache-derived,
// duplicate DOM id (`loadImageMap` keys the image id by src). Clicking the
// second image used to place the resize bar (`muya-transformer`) on the FIRST
// image, because the handler located the container via a document-wide
// `querySelector('#id ...')` that resolves to the first occurrence. The fix
// resolves the container from the clicked wrapper instead.

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

// Inject the loaded <img> the async path would produce (it never resolves under
// happy-dom) and return the per-wrapper image containers.
function injectImages(muya: Muya, src: string): HTMLElement[] {
    const wrappers = Array.from(
        muya.domNode.querySelectorAll<HTMLElement>(`span.${CLASS_NAMES.MU_INLINE_IMAGE}`),
    );
    return wrappers.map((wrapper) => {
        const container = wrapper.querySelector<HTMLElement>(
            `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
        )!;
        const img = document.createElement('img');
        img.setAttribute('src', src);
        container.appendChild(img);
        return container;
    });
}

describe('duplicate same-src images: resize bar targets the clicked image', () => {
    it('emits muya-transformer with the clicked image\'s own container', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![alt](${src})\n\n![alt](${src})`);

        const wrappers = muya.domNode.querySelectorAll<HTMLElement>(
            `span.${CLASS_NAMES.MU_INLINE_IMAGE}`,
        );
        expect(wrappers).toHaveLength(2);

        // Force the post-load collision: once the shared src has loaded, both
        // wrappers re-render with the same cache-derived id.
        wrappers[1]!.id = wrappers[0]!.id;
        expect(wrappers[1]!.id).toBe(wrappers[0]!.id);

        const containers = injectImages(muya, src);

        const handler = vi.fn();
        muya.eventCenter.on('muya-transformer', (payload: { reference?: unknown }) => {
            if (payload && payload.reference)
                handler(payload.reference);
        });

        // Click the SECOND image.
        containers[1]!
            .querySelector('img')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        // The resize bar must reference the second image's own container.
        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler).toHaveBeenCalledWith(containers[1]);
    });
});
