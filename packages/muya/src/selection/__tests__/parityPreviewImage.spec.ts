// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
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
    bootedMuyas.push(muya);
    return muya;
}

// Boot an image and inject the loaded <img> the renderer would have produced
// (the async image-load path never resolves under happy-dom). Returns the muya
// instance and the <img>.
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

// Plain-click the image to populate `selection.image` (the same state a
// real user click leaves behind before pressing Space).
function selectImage(img: HTMLImageElement): void {
    img.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('parity PG10: Space previews a selected image', () => {
    it(
        'PG10: pressing Space with an image selected emits preview-image',
        () => {
            const src = 'https://example.com/pic.png';
            const { muya, img } = bootImage(src);
            selectImage(img);
            expect(muya.editor.selection.image).toBeTruthy();

            const handler = vi.fn();
            muya.on('preview-image', handler);

            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ' ',
                    bubbles: true,
                    cancelable: true,
                }),
            );

            expect(handler).toHaveBeenCalledTimes(1);
        },
    );

    it(
        'PG10: the preview-image payload carries the selected image src',
        () => {
            const src = 'https://example.com/pic.png';
            const { muya, img } = bootImage(src);
            selectImage(img);

            let payload: unknown = null;
            muya.on('preview-image', (p: unknown) => {
                payload = p;
            });

            document.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: ' ',
                    bubbles: true,
                    cancelable: true,
                }),
            );

            expect(JSON.stringify(payload)).toContain(src);
        },
    );
});
