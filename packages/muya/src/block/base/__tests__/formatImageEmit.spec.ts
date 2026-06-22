// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import Selection from '../../../selection';

// Coverage for the PRODUCER side of the `muya-image-selector` event. When the
// user creates an inline image via the menu/shortcut (Format.format('image'))
// over a placed caret, `format()` rewrites the run to `![alt]()` and, on the
// next rAF, walks the live DOM selection up to the rendered `.mu-empty-image`
// wrapper and emits `muya-image-selector` so the image-edit tool can pop up
// asking for a src. The migration audit flagged that the RECEIVER side is
// covered (imageEditToolAutocomplete.spec.ts / imagePicker.spec.ts emit this
// event manually) but the engine producer in `format.ts` had no direct test.
//
// The text rewrite is synchronous and robust; the emit happens inside a
// `requestAnimationFrame` callback that reads the live DOM selection via
// `Selection.getSelectionStart()`. happy-dom's selection tracking is flaky, so
// for the emit assertions we stub `Selection.getSelectionStart` to return the
// rendered empty-image node (queried off the block's domNode) so the rAF
// callback deterministically finds the `.mu-empty-image` wrapper and emits.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    vi.restoreAllMocks();
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
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

// Drive `format()` over a NON-collapsed selection (`start..end`) — the way
// dragging across a word before invoking the image command wraps the run.
// happy-dom's `Selection` does not track range offsets, so stub the block's
// `getCursor` for this call so the real `format()` text surgery runs against
// the intended range. (Same technique as formatToggle.spec.ts.)
function selectInFirstBlock(muya: Muya, start: number, end: number): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    content.setCursor(start, start, true);
    (content as unknown as { getCursor: () => unknown }).getCursor = () => ({
        start: { offset: start },
        end: { offset: end },
        anchor: { offset: start },
        focus: { offset: end },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: 'forward',
        type: start === end ? 'Caret' : 'Range',
    });
    return content;
}

// Point the live DOM selection at the `.mu-empty-image` wrapper that
// `format('image')` will render, so the rAF emit branch finds it.
function stubSelectionAtEmptyImage(content: Format): void {
    vi.spyOn(Selection, 'getSelectionStart').mockImplementation(
        () => (content as unknown as { domNode: HTMLElement }).domNode.querySelector('.mu-empty-image') as never,
    );
}

interface IImageSelectorPayload {
    block: Format;
    reference: { getBoundingClientRect: () => DOMRect; width: number; height: number };
    imageInfo: { imageId: string; token: { attrs: { src: string; alt: string; title: string } } };
}

describe('format.format(\'image\') emits muya-image-selector for the new empty image', () => {
    it('rewrites the run to `![abc]()` synchronously', () => {
        // The text surgery is synchronous and the robust half of the contract.
        const content = selectInFirstBlock(bootMuya('abc\n'), 0, 3);
        content.format('image');
        expect(content.text).toBe('![abc]()');
    });

    it('renders a `.mu-empty-image` wrapper carrying the raw `![abc]()`', async () => {
        const content = selectInFirstBlock(bootMuya('abc\n'), 0, 3);
        content.format('image');
        await new Promise(resolve => requestAnimationFrame(resolve));
        const wrapper = (content as unknown as { domNode: HTMLElement }).domNode.querySelector('.mu-empty-image');
        expect(wrapper).not.toBeNull();
        expect(wrapper!.getAttribute('data-raw')).toBe('![abc]()');
    });

    it('emits `muya-image-selector` once on the post-format rAF', async () => {
        const muya = bootMuya('abc\n');
        const handler = vi.fn();
        muya.eventCenter.on('muya-image-selector', handler);

        const content = selectInFirstBlock(muya, 0, 3);
        stubSelectionAtEmptyImage(content);
        content.format('image');

        await vi.waitFor(() => {
            expect(handler).toHaveBeenCalledTimes(1);
        });
    });

    it('carries the empty image\'s imageInfo (empty src, alt from the selection)', async () => {
        const muya = bootMuya('abc\n');
        const handler = vi.fn();
        muya.eventCenter.on('muya-image-selector', handler);

        const content = selectInFirstBlock(muya, 0, 3);
        stubSelectionAtEmptyImage(content);
        content.format('image');

        await vi.waitFor(() => {
            expect(handler).toHaveBeenCalledTimes(1);
        });

        const payload = handler.mock.calls[0][0] as IImageSelectorPayload;
        // The new image has no src yet — that is exactly why the selector pops up.
        expect(payload.imageInfo.token.attrs.src).toBe('');
        // The selected run text becomes the image alt.
        expect(payload.imageInfo.token.attrs.alt).toBe('abc');
    });

    it('passes the emitting block and a positioning reference to the listener', async () => {
        const muya = bootMuya('abc\n');
        const handler = vi.fn();
        muya.eventCenter.on('muya-image-selector', handler);

        const content = selectInFirstBlock(muya, 0, 3);
        stubSelectionAtEmptyImage(content);
        content.format('image');

        await vi.waitFor(() => {
            expect(handler).toHaveBeenCalledTimes(1);
        });

        const payload = handler.mock.calls[0][0] as IImageSelectorPayload;
        expect(payload.block).toBe(content);
        // `reference` is the floating-ui anchor the image-edit tool positions against.
        expect(typeof payload.reference.getBoundingClientRect).toBe('function');
        expect(payload.reference.getBoundingClientRect()).toBeDefined();
    });

    it('does NOT emit when the selection no longer rests on an empty image', async () => {
        // If by the rAF the caret is not inside a `.mu-empty-image` wrapper
        // (e.g. the selection moved away), the producer stays silent.
        const muya = bootMuya('abc\n');
        const handler = vi.fn();
        muya.eventCenter.on('muya-image-selector', handler);

        const content = selectInFirstBlock(muya, 0, 3);
        // Selection resolves to a node OUTSIDE any image wrapper.
        vi.spyOn(Selection, 'getSelectionStart').mockReturnValue(
            document.createElement('span') as never,
        );
        content.format('image');

        await new Promise(resolve => requestAnimationFrame(resolve));
        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(handler).not.toHaveBeenCalled();
        // The text rewrite still happened — only the selector pop-up is gated.
        expect(content.text).toBe('![abc]()');
    });
});
