// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// PARITY SCOREBOARD — gap PG11 (file PG10, "heading-copy-link").
//
// Legacy `packages/muyajs` rendered a hover affordance
// (`i.icon.ag-copy-header-link`) on each heading and dispatched
// `heading-copy-link` { key } when clicked; the desktop renderer copied the
// heading's GitHub slug/anchor to the clipboard (`copyGithubSlug`).
//
// `@muyajs/core` renders no copy-anchor affordance on headings and never emits
// `heading-copy-link`; the desktop subscription was removed and documented as
// a gap. `copyGithubSlug` is now unreachable dead code.
//
// The engine now restores the hover-copy affordance (a `mu-copy-header-link`
// attachment on every heading) and emits `heading-copy-link` { key } on click,
// so these assertions pass. The `key` is the heading's stable slug — the same
// value `getTOC()` exposes as `ITocItem.slug` — so the host can resolve it.

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

// The legacy affordance class was `ag-copy-header-link`; the rewrite would use
// the `mu-` prefix. Match either so this test survives the exact class choice.
const COPY_LINK_SELECTOR
    = '.ag-copy-header-link, .mu-copy-header-link, [class*="copy-header-link"]';

describe('parity PG11: heading hover-to-copy-anchor affordance', () => {
    it(
        'PG11: a heading renders a copy-link affordance',
        () => {
            const muya = bootMuya('# Getting Started\n');
            const affordance = muya.domNode.querySelector(COPY_LINK_SELECTOR);

            // Desired: the heading exposes a hover-copy-anchor affordance.
            expect(affordance).toBeTruthy();
        },
    );

    it(
        'PG11: activating the heading copy affordance emits heading-copy-link with the block key',
        () => {
            const muya = bootMuya('# Getting Started\n');

            const handler = vi.fn();
            muya.on('heading-copy-link', handler);

            const affordance = muya.domNode.querySelector<HTMLElement>(COPY_LINK_SELECTOR);
            // The affordance must exist to drive the click; its absence is the
            // gap. Guard so the assertion below fails with a clear message
            // rather than a null-deref.
            affordance?.dispatchEvent(
                new MouseEvent('click', { bubbles: true, cancelable: true }),
            );

            // Desired: clicking the affordance emits heading-copy-link carrying
            // the heading's block key so the host can copy its anchor/slug.
            expect(handler).toHaveBeenCalledTimes(1);
            const payload = handler.mock.calls[0]?.[0];
            expect(payload?.key).toBeTruthy();
        },
    );

    it(
        'PG11: the affordance is an accessible, keyboard-focusable button',
        () => {
            const muya = bootMuya('# Getting Started\n');
            const affordance = muya.domNode.querySelector<HTMLElement>(COPY_LINK_SELECTOR)!;

            expect(affordance.getAttribute('role')).toBe('button');
            expect(affordance.getAttribute('tabindex')).toBe('0');
            expect(affordance.getAttribute('aria-label')).toBeTruthy();
            // The icon image is decorative — the button carries the label — so
            // it must expose an (empty) alt to satisfy the image-alt a11y rule.
            const img = affordance.querySelector('img')!;
            expect(img.getAttribute('alt')).toBe('');
        },
    );

    it.each(['Enter', ' '])(
        'PG11: pressing %s on the focused affordance emits heading-copy-link',
        (key) => {
            const muya = bootMuya('# Getting Started\n');

            const handler = vi.fn();
            muya.on('heading-copy-link', handler);

            const affordance = muya.domNode.querySelector<HTMLElement>(COPY_LINK_SELECTOR);
            affordance?.dispatchEvent(
                new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
            );

            // Keyboard activation mirrors click so the control is operable
            // without a pointer.
            expect(handler).toHaveBeenCalledTimes(1);
            expect(handler.mock.calls[0]?.[0]?.key).toBeTruthy();
        },
    );
});
