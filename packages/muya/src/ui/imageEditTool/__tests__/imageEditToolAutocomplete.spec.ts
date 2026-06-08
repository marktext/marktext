// @vitest-environment happy-dom
import type { Muya } from '../../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImageEditTool } from '..';
import EventCenter from '../../../event';

// Verifies the ImageEditTool ↔ ImagePathPicker wiring: as the user types in
// the image src input, the tool should call the host's `imagePathAutoComplete`
// hook and re-dispatch the result through the `muya-image-picker` event that
// the floating picker subscribes to.
//
// We run BaseFloat for real (so the src input is actually rendered) but mock
// the slice of Muya the tool touches. We do NOT call init() or build a block
// tree — the src input render path only needs i18n + the muya-image-selector
// payload.

function makeFakeMuya(imagePathAutoComplete?: (src: string) => Promise<unknown[]>): {
    muya: Muya;
    eventCenter: EventCenter;
} {
    const eventCenter = new EventCenter();
    const editorDomNode = document.createElement('div');
    const editorWrapper = document.createElement('div');
    editorWrapper.appendChild(editorDomNode);
    document.body.appendChild(editorWrapper);

    const muya = {
        domNode: editorDomNode,
        eventCenter,
        i18n: { t: (s: string) => s },
        ui: { shownFloat: new Set() },
        options: { imagePathAutoComplete },
    } as unknown as Muya;

    return { muya, eventCenter };
}

function stubReference(): HTMLElement {
    const el = document.createElement('span');
    el.getBoundingClientRect = () =>
        ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
    document.body.appendChild(el);
    return el;
}

function openTool(eventCenter: EventCenter, src: string) {
    eventCenter.emit('muya-image-selector', {
        block: { replaceImage: vi.fn() },
        reference: stubReference(),
        imageInfo: { imageId: 'id', token: { attrs: { src, alt: '', title: '' } } },
    });
}

async function nextTick() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('imageEditTool — imagePathAutoComplete wiring', () => {
    let tool: ImageEditTool;

    beforeEach(() => {
        document.body.innerHTML = '';
    });

    afterEach(() => {
        tool?.hide();
        vi.restoreAllMocks();
    });

    it('calls imagePathAutoComplete with the current src value and dispatches muya-image-picker on keyup', async () => {
        const suggestions = [{ text: 'photo.png', iconClass: 'icon-image' }];
        const autocomplete = vi.fn().mockResolvedValue(suggestions);
        const { muya, eventCenter } = makeFakeMuya(autocomplete);
        tool = new ImageEditTool(muya, { imagePathAutoComplete: autocomplete } as never);

        const pickerEvents: unknown[] = [];
        eventCenter.subscribe('muya-image-picker', (payload: unknown) => {
            pickerEvents.push(payload);
        });

        openTool(eventCenter, '/some/dir/ph');

        const input = tool.container!.querySelector('input.src') as HTMLInputElement;
        expect(input).not.toBeNull();

        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'h' }));
        await nextTick();

        expect(autocomplete).toHaveBeenCalledWith('/some/dir/ph');
        expect(pickerEvents.length).toBe(1);
        const payload = pickerEvents[0] as { list: unknown[]; reference: HTMLElement };
        expect(payload.list).toEqual(suggestions);
        expect(payload.reference).toBe(input);
    });

    it('does not call imagePathAutoComplete when the hook is absent', async () => {
        const { muya, eventCenter } = makeFakeMuya(undefined);
        tool = new ImageEditTool(muya);

        const pickerSpy = vi.fn();
        eventCenter.subscribe('muya-image-picker', pickerSpy);

        openTool(eventCenter, '/some/dir/ph');
        const input = tool.container!.querySelector('input.src') as HTMLInputElement;
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'h' }));
        await nextTick();

        expect(pickerSpy).not.toHaveBeenCalled();
    });
});
