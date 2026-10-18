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
    document.body.innerHTML = '';
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

describe('inline <br> marker', () => {
    it('collapses the literal marker while keeping a real <br> line break', () => {
        const muya = boot('Line 1<br/>Line 2');
        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_HTML_TAG}`,
        )!;
        const marker = wrapper.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_HIDE}`,
        )!;

        expect(marker.textContent).toBe('<br/>');
        expect(marker.classList.contains(CLASS_NAMES.MU_OUTPUT_REMOVE)).toBe(true);
        expect(marker.querySelector('br')).toBeNull();
        expect(wrapper.querySelector('br')).not.toBeNull();
    });

    it('reveals the marker once the caret sits inside the <br> token', () => {
        const muya = boot('Line 1<br/>Line 2');
        muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(7, 7, true);

        const wrapper = muya.domNode.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_HTML_TAG}`,
        )!;
        const marker = wrapper.querySelector<HTMLElement>(
            `span.${CLASS_NAMES.MU_HTML_TAG}.${CLASS_NAMES.MU_OUTPUT_REMOVE}`,
        )!;

        expect(marker.textContent).toBe('<br/>');
        expect(marker.classList.contains(CLASS_NAMES.MU_HIDE)).toBe(false);
    });
});
