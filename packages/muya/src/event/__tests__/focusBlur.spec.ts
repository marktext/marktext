// @vitest-environment happy-dom

import { describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

// Regression for marktext commit 9eff8248
// "feat: add two event focus and blur of muya (#1039)".
//
// External SDK consumers need a way to react when the editor gains or loses
// focus — for example, to show/hide their own surrounding chrome. marktext
// did the wiring in the `Muya` constructor with `attachDOMEvent` so it
// piggy-backs on `detachAllDomEvents()` cleanup. We mirror that placement
// (in the constructor, not in `editor.init()`) so a fresh `new Muya(el)` —
// without calling `init()` — already emits the events. This keeps tests
// cheap (no scrollPage / block tree / UI bootstrap) and matches the public
// "event surface is wired before init" expectation.

describe('muya focus / blur events (marktext 9eff8248)', () => {
    it('emits "focus" through the event center when the dom node receives focus', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const muya = new Muya(el);
        const handler = vi.fn();
        muya.on('focus', handler);

        muya.domNode.dispatchEvent(new Event('focus'));

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('emits "blur" through the event center when the dom node loses focus', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const muya = new Muya(el);
        const handler = vi.fn();
        muya.on('blur', handler);

        muya.domNode.dispatchEvent(new Event('blur'));

        expect(handler).toHaveBeenCalledTimes(1);
    });

    it('detaches focus / blur listeners on destroy', () => {
        const el = document.createElement('div');
        document.body.appendChild(el);

        const muya = new Muya(el);
        const handler = vi.fn();
        muya.on('focus', handler);

        // Capture the domNode before destroy removes it from the DOM.
        const node = muya.domNode;
        muya.destroy();
        node.dispatchEvent(new Event('focus'));

        expect(handler).not.toHaveBeenCalled();
    });
});
