// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../config';
import { Muya } from '../../../muya';

// P3 defensive lock for marktext `81af43be` ("hide quick-insert hint on
// empty paragraph"). The hint is the `Type / to insert blocks` ghost text
// that the CSS rule `.mu-show-quick-insert-hint .mu-paragraph.mu-active >
// .mu-paragraph-content:first-of-type::after` paints into empty active
// paragraphs.
//
// Toggle is muya option `hideQuickInsertHint` (default false). The wiring
// lives in `muya.ts::getContainer` — when the option is true, the
// `mu-show-quick-insert-hint` class is **not** added to the editor
// container, so the CSS selector never matches and the ghost text never
// renders. If a refactor ever drops that branch, every consumer that opted
// out of the hint would suddenly see it again, silently.
//
// We only assert the class-on-container contract (the public observable),
// not the CSS rule itself.

const HINT_CLASS = CLASS_NAMES.MU_SHOW_QUICK_INSERT_HINT;
const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    // happy-dom does not define MUYA_VERSION; Muya reads window.MUYA_VERSION
    // at construct time. Save the current value so afterEach can restore it.
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    // Remove each editor host node from document.body to avoid DOM growth
    // across tests in the same worker.
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    // Restore the pre-test value of window.MUYA_VERSION (delete if it was
    // unset before we ran).
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(options: Partial<ConstructorParameters<typeof Muya>[1]> = {}) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    // Constructor wires up the container; we never call init() so no blocks
    // are registered and no editor lifecycle is started.
    const muya = new Muya(host, options as ConstructorParameters<typeof Muya>[1]);
    // Track the post-`getContainer` node (host is replaced in place, so the
    // new container shares the body parent).
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('muya option hideQuickInsertHint — container class wiring', () => {
    it('omitted (default): container has the mu-show-quick-insert-hint class', () => {
        const muya = bootMuya();
        expect(muya.domNode.classList.contains(HINT_CLASS)).toBe(true);
    });

    it('hideQuickInsertHint: false → container has the class (hint visible)', () => {
        const muya = bootMuya({ hideQuickInsertHint: false });
        expect(muya.domNode.classList.contains(HINT_CLASS)).toBe(true);
    });

    it('hideQuickInsertHint: true → container does NOT have the class (hint suppressed)', () => {
        const muya = bootMuya({ hideQuickInsertHint: true });
        expect(muya.domNode.classList.contains(HINT_CLASS)).toBe(false);
    });
});
