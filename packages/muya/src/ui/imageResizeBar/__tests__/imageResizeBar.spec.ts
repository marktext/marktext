// @vitest-environment happy-dom
import type { Muya } from '../../../muya';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageResizeBar } from '..';
import EventCenter from '../../../event';

const appendedNodes: ChildNode[] = [];

function setup(): EventCenter {
    const eventCenter = new EventCenter();
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
