// @vitest-environment happy-dom
import type { Muya } from '../../../muya';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageResizeBar } from '..';
import EventCenter from '../../../event';

const appendedNodes: ChildNode[] = [];
const eventCenters: EventCenter[] = [];

function setup(): EventCenter {
    const eventCenter = new EventCenter();
    eventCenters.push(eventCenter);
    const domNode = document.createElement('div');
    document.body.appendChild(domNode);
    appendedNodes.push(domNode);
    // eslint-disable-next-line no-new
    new ImageResizeBar({ domNode, eventCenter } as unknown as Muya);
    return eventCenter;
}

function imageContainer(): HTMLElement {
    const container = document.createElement('span');
    container.appendChild(document.createElement('img'));
    container.getBoundingClientRect = () =>
        ({ top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => '' }) as DOMRect;
    document.body.appendChild(container);
    appendedNodes.push(container);
    return container;
}

afterEach(() => {
    vi.useRealTimers();
    // Every bar listens on the shared document.body; drop them so one test's
    // bar does not react to the next test's mouse events.
    while (eventCenters.length)
        eventCenters.pop()!.detachAllDomEvents();
    while (appendedNodes.length)
        appendedNodes.pop()!.remove();
    document.querySelectorAll('.mu-transformer').forEach(el => el.remove());
});

describe('image resize bar after its image is removed', () => {
    it('skips the deferred render when the reference was cleared first (#5216)', () => {
        vi.useFakeTimers();
        const eventCenter = setup();

        eventCenter.emit('muya-transformer', { block: {}, reference: imageContainer(), imageInfo: {} });
        eventCenter.emit('muya-transformer', { reference: null });

        expect(() => vi.runAllTimers()).not.toThrow();
        expect(document.querySelectorAll('.mu-transformer .bar')).toHaveLength(0);
    });

    it('stops following the mouse when hidden in the middle of a drag', () => {
        vi.useFakeTimers();
        const eventCenter = setup();

        eventCenter.emit('muya-transformer', { block: {}, reference: imageContainer(), imageInfo: {} });
        vi.runAllTimers();
        const handle = document.querySelector<HTMLElement>('.mu-transformer .bar.right')!;
        handle.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

        eventCenter.emit('muya-transformer', { reference: null });

        expect(eventCenter.events.some(e => e.target === document.body && e.event === 'mousemove')).toBe(false);

        const listenerErrors: unknown[] = [];
        const onError = (event: ErrorEvent) => listenerErrors.push(event.error ?? event.message);
        window.addEventListener('error', onError);
        try {
            expect(() => document.body.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 40 }))).not.toThrow();
        }
        finally {
            window.removeEventListener('error', onError);
        }
        expect(listenerErrors).toEqual([]);
    });
});

// Raw HTML and mermaid `classDef bar` put elements with the handles' `bar`
// class into the document.
function contentBar(): HTMLElement {
    const bar = document.createElement('span');
    bar.classList.add('bar');
    bar.textContent = 'progress bar';
    document.body.appendChild(bar);
    appendedNodes.push(bar);
    return bar;
}

// happy-dom's MouseEvent has no `x`, and `_mouseMove` ignores events without it.
function mouseMove(clientX: number): MouseEvent {
    const event = new MouseEvent('mousemove', { bubbles: true, clientX });
    Object.defineProperty(event, 'x', { value: clientX });
    return event;
}

// happy-dom rethrows listener errors from dispatchEvent; collect them per
// step so a throwing mousemove still lets the mouseup run.
function dragFrom(target: HTMLElement, clientX = 40): unknown[] {
    const listenerErrors: unknown[] = [];
    const steps: Array<[EventTarget, Event]> = [
        [target, new MouseEvent('mousedown', { bubbles: true })],
        [document.body, mouseMove(clientX)],
        [document.body, new MouseEvent('mouseup', { bubbles: true })],
    ];
    for (const [eventTarget, event] of steps) {
        try {
            eventTarget.dispatchEvent(event);
        }
        catch (error) {
            listenerErrors.push(error);
        }
    }
    return listenerErrors;
}

describe('image resize bar and document content with class "bar" (#5116)', () => {
    it('does not start a resize from content when no image was clicked', () => {
        setup();

        expect(dragFrom(contentBar())).toEqual([]);
    });

    it('does not resize the last clicked image from content after the bar hides', () => {
        vi.useFakeTimers();
        const eventCenter = setup();
        const block = { updateImage: vi.fn() };
        const reference = imageContainer();

        eventCenter.emit('muya-transformer', { block, reference, imageInfo: {} });
        vi.runAllTimers();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(document.querySelectorAll('.mu-transformer .bar')).toHaveLength(0);

        const errors = dragFrom(contentBar());

        expect(block.updateImage).not.toHaveBeenCalled();
        expect(errors).toEqual([]);
        expect(reference.querySelector('img')!.hasAttribute('width')).toBe(false);
    });

    it('does not resize the shown image from content', () => {
        vi.useFakeTimers();
        const eventCenter = setup();
        const block = { updateImage: vi.fn() };
        const reference = imageContainer();

        eventCenter.emit('muya-transformer', { block, reference, imageInfo: {} });
        vi.runAllTimers();

        const errors = dragFrom(contentBar());

        expect(errors).toEqual([]);
        expect(block.updateImage).not.toHaveBeenCalled();
        expect(reference.querySelector('img')!.hasAttribute('width')).toBe(false);
        expect(document.querySelectorAll('.mu-transformer .bar')).toHaveLength(2);
    });

    it('attaches no drag listeners for a press on content that never gets its mouseup', () => {
        vi.useFakeTimers();
        const eventCenter = setup();
        const reference = imageContainer();

        eventCenter.emit('muya-transformer', { block: { updateImage: vi.fn() }, reference, imageInfo: {} });
        vi.runAllTimers();
        // A right press opens the context menu, which takes the mouseup.
        contentBar().dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 2 }));
        document.body.dispatchEvent(mouseMove(200));

        expect(eventCenter.events.some(e => e.target === document.body && e.event === 'mousemove')).toBe(false);
        expect(reference.querySelector('img')!.hasAttribute('width')).toBe(false);
    });

    it('does not resize the image from a handle without a left or right side', () => {
        vi.useFakeTimers();
        const eventCenter = setup();
        const block = { updateImage: vi.fn() };
        const reference = imageContainer();

        eventCenter.emit('muya-transformer', { block, reference, imageInfo: {} });
        vi.runAllTimers();
        const handle = document.querySelector<HTMLElement>('.mu-transformer .bar.right')!;
        handle.removeAttribute('data-position');

        const errors = dragFrom(handle, 200);

        expect(errors).toEqual([]);
        expect(block.updateImage).not.toHaveBeenCalled();
        expect(reference.querySelector('img')!.hasAttribute('width')).toBe(false);
    });

    it('still resizes the image from its own handle', () => {
        vi.useFakeTimers();
        const eventCenter = setup();
        const block = { updateImage: vi.fn() };
        const imageInfo = {};

        eventCenter.emit('muya-transformer', { block, reference: imageContainer(), imageInfo });
        vi.runAllTimers();

        const errors = dragFrom(document.querySelector<HTMLElement>('.mu-transformer .bar.right')!, 200);

        expect(errors).toEqual([]);
        // happy-dom has no layout, so the left handle sits at x 0: 200 - 0 - CIRCLE_RADIO.
        expect(block.updateImage).toHaveBeenCalledWith(imageInfo, 'width', '195');
    });
});
