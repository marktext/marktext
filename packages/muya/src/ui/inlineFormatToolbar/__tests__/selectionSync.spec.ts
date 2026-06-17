// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';
import { InlineFormatToolbar } from '../index';

// The toolbar must perceive inline-format changes itself and update its
// active-state highlight, rather than the engine telling it to. Any format
// change — including ones applied OUTSIDE the toolbar (the desktop Format menu,
// a command, a keyboard shortcut) — ends in a selection update that
// re-broadcasts the selection's current formats via `selection-change`. While
// the toolbar is open it listens for that and re-renders, so e.g. bolding the
// selection from the menu lights up the bold button.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    // baseFloat observes its container with a ResizeObserver; happy-dom doesn't
    // ship one, so stand in a no-op.
    if (typeof globalThis.ResizeObserver === 'undefined') {
        globalThis.ResizeObserver = class {
            observe() {}
            unobserve() {}
            disconnect() {}
        } as never;
    }
});

afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function emitSelectionChange(
    muya: Muya,
    formats: Array<{ type: string }>,
    extra: { isCollapsed?: boolean; isSelectionInSameBlock?: boolean } = {},
): void {
    muya.eventCenter.emit('selection-change', {
        formats,
        isCollapsed: extra.isCollapsed ?? false,
        isSelectionInSameBlock: extra.isSelectionInSameBlock ?? true,
    });
}

describe('inlineFormatToolbar self-syncs its highlight on selection-change', () => {
    it('lights up bold when a selection-change reports strong while the toolbar is open', () => {
        const muya = bootMuya('hello world\n');
        const toolbar = new InlineFormatToolbar(muya);
        toolbar.status = true; // the toolbar is open over a selection

        emitSelectionChange(muya, [{ type: 'strong' }]);

        const boldItem = toolbar.container!.querySelector('li.item.strong');
        expect(boldItem).toBeTruthy();
        expect(boldItem!.classList.contains('active')).toBe(true);
    });

    it('drops the highlight when a later selection-change no longer reports the format', () => {
        const muya = bootMuya('**bold** plain\n');
        const toolbar = new InlineFormatToolbar(muya);
        toolbar.status = true;

        emitSelectionChange(muya, [{ type: 'strong' }]);
        expect(toolbar.container!.querySelector('li.item.strong')!.classList.contains('active')).toBe(true);

        emitSelectionChange(muya, []); // selection moved to unformatted text
        expect(toolbar.container!.querySelector('li.item.strong')!.classList.contains('active')).toBe(false);
    });

    it('ignores selection-change while the toolbar is hidden', () => {
        const muya = bootMuya('hello world\n');
        const toolbar = new InlineFormatToolbar(muya);
        toolbar.status = false; // closed

        emitSelectionChange(muya, [{ type: 'strong' }]);

        // The handler bails before the first render, so nothing is drawn.
        expect(toolbar.container!.querySelector('li.item.strong')).toBeNull();
    });

    it('ignores collapsed / cross-block selections (single-block tool)', () => {
        const muya = bootMuya('hello world\n');
        const toolbar = new InlineFormatToolbar(muya);
        toolbar.status = true;

        emitSelectionChange(muya, [{ type: 'strong' }], { isCollapsed: true });
        expect(toolbar.container!.querySelector('li.item.strong')).toBeNull();

        emitSelectionChange(muya, [{ type: 'strong' }], { isSelectionInSameBlock: false });
        expect(toolbar.container!.querySelector('li.item.strong')).toBeNull();
    });
});
