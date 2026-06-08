// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

// PARITY SCOREBOARD — gap PG12 (file PG12).
//
// Legacy `packages/muyajs` read `muya.options.hideLinkPopup` in
// `eventHandler/mouseEvent.js`: the link-hover handler only dispatched
// `muya-link-tools` (the link-edit/jump popover) when `!hideLinkPopup`. So
// `hideLinkPopup: true` suppressed the popover on link hover.
//
// `editor/linkMouseEvents.ts#overHandler` now reads `muya.options.hideLinkPopup`
// and returns early when it is set, so the popover is suppressed on hover —
// restoring parity. The gap test below asserts that suppression; the positive
// control proves the harness actually drives the hover emit.

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    // `destroy()` detaches the engine's DOM listeners — including the
    // `document`-level handlers registered during init — and removes the host
    // node, so listeners don't leak across tests.
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, options: Record<string, unknown> = {}): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, {
        markdown,
        ...options,
    } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

// Return the rendered link wrapper, forced into preview mode (the preceding
// source-marker sibling carries `.mu-hide`, which `isPopoverTarget` requires).
function previewLink(muya: Muya): HTMLElement {
    const link = muya.domNode.querySelector<HTMLElement>(`span.${CLASS_NAMES.MU_LINK}`)!;
    link.previousElementSibling?.classList.add(CLASS_NAMES.MU_HIDE);
    return link;
}

function hover(link: HTMLElement): void {
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
}

// A `muya-link-tools` payload with a truthy `reference` opens the popover; a
// null reference hides it. Count only the popover-opening emits.
function countOpenEmits(handler: ReturnType<typeof vi.fn>): number {
    return handler.mock.calls.filter(c => c[0]?.reference).length;
}

describe('parity PG12: hideLinkPopup gates the link hover popover', () => {
    it('control: with hideLinkPopup=false, hovering a preview link opens the popover', () => {
        const muya = bootMuya('[hello](https://example.com)\n', { hideLinkPopup: false });
        const link = previewLink(muya);

        const handler = vi.fn();
        muya.on('muya-link-tools', handler);
        hover(link);

        expect(countOpenEmits(handler)).toBe(1);
    });

    it(
        'PG12: with hideLinkPopup=true, hovering a preview link does NOT open the popover',
        () => {
            const muya = bootMuya('[hello](https://example.com)\n', { hideLinkPopup: true });
            const link = previewLink(muya);

            const handler = vi.fn();
            muya.on('muya-link-tools', handler);
            hover(link);

            // Desired: the popover stays suppressed when the preference is set.
            // Today the emitter ignores the option and opens it anyway.
            expect(countOpenEmits(handler)).toBe(0);
        },
    );
});
