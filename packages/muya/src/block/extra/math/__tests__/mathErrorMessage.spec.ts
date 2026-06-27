// @vitest-environment happy-dom

import type { Muya as MuyaType } from '../../../../muya';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// #2220 — "How to debug <Invalid Mathematical Formula>?". The live editor
// caught KaTeX's parse error and replaced it with an opaque generic message,
// so the user had no idea WHAT was wrong. Surface KaTeX's actual parse-error
// reason: inline math keeps the compact baseline-aligned label but exposes the
// message via the title (a long message inline would break the text baseline —
// #4100 / inline-math-align); block math shows the message text directly.

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

describe('#2220 — invalid math surfaces the KaTeX parse error, not a generic message', () => {
    it('inline math `$\\frac{1}{$` carries the parse reason in the .mu-math-error title (compact label kept)', () => {
        const muya = bootMuya('$\\frac{1}{$\n');
        const errorEl = muya.domNode.querySelector('.mu-math-error');
        expect(errorEl).not.toBeNull();
        // The visible label stays compact (baseline-safe); the reason is on the title.
        expect(errorEl!.getAttribute('title') ?? '').toMatch(/parse error/i);
        expect(errorEl!.textContent ?? '').toContain('Invalid Mathematical Formula');
    });

    it('block math `$$\\frac{1}{$$` shows the parse reason in .mu-math-error', () => {
        const muya = bootMuya('$$\n\\frac{1}{\n$$\n');
        const errorEl = muya.domNode.querySelector('.mu-math-error');
        expect(errorEl).not.toBeNull();
        expect(errorEl!.textContent ?? '').toMatch(/parse error/i);
        expect(muya.domNode.textContent ?? '').not.toContain('Invalid Mathematical Formula');
    });
});
