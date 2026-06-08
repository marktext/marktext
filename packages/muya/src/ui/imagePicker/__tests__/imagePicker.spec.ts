// @vitest-environment happy-dom
import type { Muya } from '../../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImagePathPicker } from '..';
import EventCenter from '../../../event';

// Smoke + integration tests for the ImagePathPicker floating autocomplete UI.
//
// The picker is a BaseScrollFloat subclass driven entirely by the
// `muya-image-picker` event: the ImageEditTool fetches suggestions from the
// host's `imagePathAutoComplete` hook and dispatches them here. We mock the
// slice of Muya the picker touches (eventCenter, domNode, i18n, ui) and run
// BaseFloat/BaseScrollFloat for real so the snabbdom render path is exercised
// end-to-end in happy-dom.

function makeFakeMuya(): { muya: Muya; eventCenter: EventCenter } {
    const eventCenter = new EventCenter();
    const editorDomNode = document.createElement('div');
    const editorWrapper = document.createElement('div');
    editorWrapper.appendChild(editorDomNode);
    document.body.appendChild(editorWrapper);

    const shownFloat = new Set();
    // Mirror Ui.listen so `status` flips when the float shows/hides.
    eventCenter.subscribe('muya-float', (tool: unknown, status: boolean) => {
        status ? shownFloat.add(tool) : shownFloat.delete(tool);
    });

    const muya = {
        domNode: editorDomNode,
        eventCenter,
        i18n: { t: (s: string) => s },
        ui: { shownFloat },
        options: {},
    } as unknown as Muya;

    return { muya, eventCenter };
}

function stubReference(): HTMLElement {
    const input = document.createElement('input');
    // BaseFloat computes position off the reference; happy-dom has no layout,
    // so a stubbed rect keeps autoUpdate from throwing.
    input.getBoundingClientRect = () =>
        ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
    document.body.appendChild(input);
    return input;
}

async function nextTick() {
    await new Promise(resolve => setTimeout(resolve, 0));
}

describe('imagePathPicker — plugin shape', () => {
    it('exposes a stable static pluginName so Muya.use registers it under "imagePathPicker"', () => {
        expect(ImagePathPicker.pluginName).toBe('imagePathPicker');
    });
});

describe('imagePathPicker — render on muya-image-picker event', () => {
    let muya: Muya;
    let eventCenter: EventCenter;
    let picker: ImagePathPicker;

    beforeEach(() => {
        ({ muya, eventCenter } = makeFakeMuya());
        picker = new ImagePathPicker(muya);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders one list item per suggestion and marks the first active', async () => {
        const reference = stubReference();
        const list = [
            { text: 'a.png', iconClass: 'icon-image' },
            { text: 'sub', iconClass: 'icon-folder', type: 'directory' },
        ];

        eventCenter.emit('muya-image-picker', { reference, list, cb: () => {} });
        await nextTick();

        const items = picker.floatBox!.querySelectorAll('li.item');
        expect(items.length).toBe(2);
        expect(items[0].classList.contains('active')).toBe(true);
        expect(items[0].querySelector('.text')?.textContent).toBe('a.png');
        // Icon class is rendered when supplied.
        expect(items[1].querySelector('.icon-wrapper span.icon-folder')).not.toBeNull();
        expect(picker.status).toBe(true);
    });

    it('hides instead of showing when the suggestion list is empty', async () => {
        const reference = stubReference();
        eventCenter.emit('muya-image-picker', { reference, list: [], cb: () => {} });
        await nextTick();

        expect(picker.status).toBe(false);
    });

    it('invokes the selection callback with the chosen item on click', async () => {
        const reference = stubReference();
        const cb = vi.fn();
        const list = [{ text: 'first.png' }, { text: 'second.png' }];

        eventCenter.emit('muya-image-picker', { reference, list, cb });
        await nextTick();

        const second = picker.floatBox!.querySelector('[data-index="1"]') as HTMLElement;
        second.click();

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(list[1]);
    });

    it('moves the active item with step("next") and selects it via the active item', async () => {
        const reference = stubReference();
        const cb = vi.fn();
        const list = [{ text: 'one.png' }, { text: 'two.png' }, { text: 'three.png' }];

        eventCenter.emit('muya-image-picker', { reference, list, cb });
        await nextTick();

        picker.step('next');
        expect(picker.activeItem).toBe(list[1]);

        picker.selectItem(picker.activeItem);
        expect(cb).toHaveBeenCalledWith(list[1]);
    });
});
