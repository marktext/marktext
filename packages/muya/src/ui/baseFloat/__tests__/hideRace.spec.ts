// @vitest-environment happy-dom

import type { Muya } from '../../../index';
import { describe, expect, it, vi } from 'vitest';
import BaseFloat from '../index';

// REGRESSION GUARD — table row menu (and any baseFloat) failing to auto-hide.
//
// baseFloat.show() positions the float through @floating-ui's async
// `computePosition().then()`, which sets `opacity: 1`. If `hide()` runs while
// such an update is still in flight (or the update resolves afterwards), the
// pending `.then()` re-reveals an already-hidden float — and because it never
// restores `status`, a later `hide()` early-returns and the float is stuck
// visible. Reported against "Insert Row Above/Below": the TableRowColumMenu
// stayed on screen after picking an item.

class TestFloat extends BaseFloat {}

function makeFloat(): TestFloat {
    const muya = { eventCenter: { emit: vi.fn() } } as unknown as Muya;
    return new TestFloat(muya, 'mu-test-float');
}

const reference = {
    getBoundingClientRect: () => ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON() {},
    }),
};

const tick = () => new Promise(resolve => setTimeout(resolve, 20));

describe('baseFloat hide() vs in-flight position update', () => {
    it('stays hidden when hide() interrupts the initial position update', async () => {
        const float = makeFloat();
        float.show(reference);
        // hide() before the async computePosition().then() resolves.
        float.hide();
        await tick();

        expect(float.floatBox!.style.opacity).toBe('0');
        expect(float.status).toBe(false);
    });

    it('a stale position update cannot resurrect a hidden float', async () => {
        const float = makeFloat();
        float.show(reference);
        await tick();
        expect(float.floatBox!.style.opacity).toBe('1');

        float.hide();
        // Even after every pending microtask/timer settles, the float must
        // remain hidden — no late `.then()` may flip opacity back to 1.
        await tick();
        expect(float.floatBox!.style.opacity).toBe('0');
    });
});
