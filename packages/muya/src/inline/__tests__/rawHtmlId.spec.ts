// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../config';
import { Muya } from '../../muya';

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    (window as unknown as { MUYA_VERSION?: string }).MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as unknown as { MUYA_VERSION?: string }).MUYA_VERSION;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

function rawHtmlElement(muya: Muya): HTMLElement {
    const el = muya.domNode.querySelector<HTMLElement>(`.${CLASS_NAMES.MU_RAW_HTML}`);
    expect(el).not.toBeNull();
    return el!;
}

describe('inline raw HTML id (#5419)', () => {
    it.each(['v1.2', 'api/usage', 'a#b', 'note 1'])('keeps the id %j verbatim', (id) => {
        const muya = boot(`text <a id="${id}">anchor</a> text`);
        const el = rawHtmlElement(muya);

        expect(el.id).toBe(id);
        expect(document.getElementById(id)).toBe(el);
    });

    it('does not turn part of the id into a class', () => {
        const muya = boot('text <a id="v1.2" class="note">anchor</a> text');
        const el = rawHtmlElement(muya);

        expect(el.classList.contains('2')).toBe(false);
        expect(el.classList.contains('note')).toBe(true);
        expect(el.classList.contains(CLASS_NAMES.MU_INLINE_RULE)).toBe(true);
    });

    it('escapes quotes in the id instead of breaking the markup', () => {
        const muya = boot('text <span id="a&quot;b">x</span> text');
        const el = rawHtmlElement(muya);

        expect(el.id).toBe('a"b');
        expect(el.textContent).toBe('x');
    });
});
