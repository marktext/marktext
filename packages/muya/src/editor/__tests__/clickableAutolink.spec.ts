// @vitest-environment happy-dom

import type { Muya as MuyaType } from '../../muya';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// #2165 — "make it easy to follow a link". CommonMark autolinks
// (`<https://x.com>`) and GFM bare-URL autolinks (`https://x.com`) render as
// `a.mu-auto-link` / `a.mu-auto-link-extension`, but those classes were absent
// from linkMouseEvents' LINK_SELECTOR and the renderers never set `data-raw`,
// so `getLinkInfo` returned null and a Cmd/Ctrl-click never emitted
// `format-click` — the link could not be followed. These boot a real engine,
// render each autolink variant, and assert a modifier-click asks the host to
// open it.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): MuyaType {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

interface IFormatClick { formatType: string; data: { href: string | null; raw: string } }

function captureFormatClick(muya: MuyaType): IFormatClick[] {
    const emits: IFormatClick[] = [];
    muya.eventCenter.subscribe('format-click', (payload: IFormatClick) => emits.push(payload));
    return emits;
}

function modifierClick(el: Element) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true }));
}

describe('#2165 — autolinks are followable via Cmd/Ctrl-click', () => {
    it('renders a.mu-auto-link with data-raw + href for a CommonMark autolink `<https://example.com>`', () => {
        const muya = bootMuya('<https://example.com>\n');
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link');
        expect(anchor).not.toBeNull();
        expect(anchor!.dataset.raw).toBeTruthy();
        expect(anchor!.getAttribute('href')).toContain('https://example.com');
    });

    it('a Ctrl-click on a CommonMark autolink emits format-click with the href', () => {
        const muya = bootMuya('<https://example.com>\n');
        const emits = captureFormatClick(muya);
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link')!;

        modifierClick(anchor);

        expect(emits).toHaveLength(1);
        expect(emits[0].formatType).toBe('link');
        expect(emits[0].data.href).toContain('https://example.com');
    });

    it('renders a.mu-auto-link-extension for a bare GFM URL `https://example.com` and follows it', () => {
        const muya = bootMuya('see https://example.com here\n');
        const emits = captureFormatClick(muya);
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link-extension');
        expect(anchor).not.toBeNull();
        expect(anchor!.dataset.raw).toBeTruthy();

        modifierClick(anchor!);

        expect(emits).toHaveLength(1);
        expect(emits[0].data.href).toContain('https://example.com');
    });

    it('a plain (non-modifier) click on an autolink does NOT emit format-click', () => {
        const muya = bootMuya('<https://example.com>\n');
        const emits = captureFormatClick(muya);
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link')!;

        anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        expect(emits).toHaveLength(0);
    });

    it('hovering an autolink does NOT open the edit/unlink popover (follow-only)', () => {
        const muya = bootMuya('<https://example.com>\n');
        const popoverEmits: unknown[] = [];
        muya.eventCenter.subscribe('muya-link-tools', (p: { reference: unknown }) => {
            if (p.reference)
                popoverEmits.push(p);
        });
        const anchor = muya.domNode.querySelector<HTMLAnchorElement>('a.mu-auto-link')!;

        anchor.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        expect(popoverEmits).toHaveLength(0);
    });
});
