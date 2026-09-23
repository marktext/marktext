// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

// Regression (#5391): with the caret on the image's own line, clicking the
// image blurs the paragraph, and `Format.blurHandler` re-renders it — which
// reassigns the paragraph's `innerHTML` and so replaces the image's DOM nodes.
// The click handler used to emit `muya-transformer` (and the toolbar's rect)
// from the pre-render nodes, leaving the resize bar anchored to a detached
// container whose rect is all zeros, drawing its handles in the window's
// corner instead of on the image.

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
// happy-dom), so the click takes the handler's `target.tagName === 'IMG'` branch.
function injectImage(muya: Muya, src: string): HTMLElement {
    const container = muya.domNode.querySelector<HTMLElement>(
        `.${CLASS_NAMES.MU_IMAGE_CONTAINER}`,
    )!;
    const img = document.createElement('img');
    img.setAttribute('src', src);
    container.appendChild(img);
    return container;
}

describe('image click with the caret on the image\'s line (#5391)', () => {
    it('references the image container that is in the document after the click', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![alt](${src})\n\nafter`);

        // `muya.init()` focuses the first block, so the caret sits at offset 0
        // of the image's paragraph — the state a freshly opened document is in.
        const container = injectImage(muya, src);

        const references: unknown[] = [];
        muya.eventCenter.on('muya-transformer', (payload: { reference?: unknown }) => {
            if (payload && payload.reference)
                references.push(payload.reference);
        });

        container
            .querySelector('img')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(references).toHaveLength(1);
        const reference = references[0] as HTMLElement;
        expect(reference.classList.contains(CLASS_NAMES.MU_IMAGE_CONTAINER)).toBe(true);
        expect(muya.domNode.contains(reference)).toBe(true);
    });

    it('still references the clicked image when the paragraph holds several', () => {
        const src = 'https://example.com/pic.png';
        const muya = boot(`![a](${src}) and ![b](${src}) and ![c](${src})`);

        const containers = Array.from(
            muya.domNode.querySelectorAll<HTMLElement>(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`),
        );
        containers.forEach((container) => {
            const img = document.createElement('img');
            img.setAttribute('src', src);
            container.appendChild(img);
        });

        const handler = vi.fn();
        muya.eventCenter.on('muya-transformer', (payload: { reference?: unknown }) => {
            if (payload && payload.reference)
                handler(payload.reference);
        });

        containers[1]!
            .querySelector('img')!
            .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(handler).toHaveBeenCalledTimes(1);
        const reference = handler.mock.calls[0]![0] as HTMLElement;
        expect(muya.domNode.contains(reference)).toBe(true);
        // Second of the three, whether or not the re-render replaced the nodes.
        const live = Array.from(
            muya.domNode.querySelectorAll<HTMLElement>(`.${CLASS_NAMES.MU_IMAGE_CONTAINER}`),
        );
        expect(live.indexOf(reference)).toBe(1);
    });
});
