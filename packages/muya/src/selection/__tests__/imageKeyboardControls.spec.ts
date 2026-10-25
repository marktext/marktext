// @vitest-environment happy-dom

import { afterEach, expect, it, vi } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../__tests__/muyaHarness';

useMuyaHarness();

const controls: HTMLElement[] = [];

afterEach(() => {
    while (controls.length)
        controls.pop()!.remove();
});

for (const tag of ['input', 'textarea', 'select', 'contenteditable'] as const) {
    it(`does not intercept keys bubbling from an external ${tag}`, () => {
        const markdown = '![selected](https://example.com/image.png)\n';
        const muya = bootMuya(markdown);
        const image = muya.domNode.querySelector<HTMLElement>('.mu-inline-image')!;
        image.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const before = muya.getSelectionState();
        expect(before?.kind).toBe('image');
        const preview = vi.fn();
        muya.on('preview-image', preview);
        const control = document.createElement(tag === 'contenteditable' ? 'div' : tag);
        if (tag === 'contenteditable')
            control.contentEditable = 'true';
        document.body.appendChild(control);
        controls.push(control);
        const target = tag === 'contenteditable'
            ? control.appendChild(document.createElement('span'))
            : control;

        for (const key of ['ArrowLeft', 'ArrowRight', 'Backspace', 'Delete', 'Enter', ' ']) {
            const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
            target.dispatchEvent(event);
            expect(event.defaultPrevented, key).toBe(false);
            expect(muya.getSelectionState(), key).toEqual(before);
            expect(muya.getMarkdown(), key).toBe(markdown);
        }
        expect(preview).not.toHaveBeenCalled();
    });
}

for (const key of ['ArrowLeft', 'ArrowRight']) {
    it(`still moves from the selected image into the document on ${key}`, () => {
        const raw = '![selected](https://example.com/image.png)';
        const muya = bootMuya(`${raw}\n`);
        const image = muya.domNode.querySelector<HTMLElement>('.mu-inline-image')!;
        image.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        muya.domNode.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(muya.getSelectionState()?.kind).toBe('text');
    });
}
