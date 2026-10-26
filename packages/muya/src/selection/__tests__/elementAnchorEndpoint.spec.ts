// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { resolveEndpoint } from '../dom';

// Regression (#5239): a browser reports a child index, not a character offset,
// when the caret is anchored to an element.

const hosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (hosts.length)
        hosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
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
    hosts.push(muya.domNode);
    return muya;
}

function firstContent(muya: Muya): Content {
    return muya.editor.scrollPage!.firstContentInDescendant()!;
}

describe('resolveEndpoint — element-anchored caret', () => {
    it('maps a child index to a text offset after a trailing `<br>`', () => {
        const content = firstContent(bootMuya('foo\n'));
        content.domNode!.innerHTML = 'foo\n<br>';

        const resolved = resolveEndpoint(content.domNode!, 1);

        expect(resolved?.offset).toBe(4);
        expect(resolved?.block).toBe(content);
    });

    it('still reads a text-node endpoint as a character offset', () => {
        const content = firstContent(bootMuya('foo\n'));
        content.domNode!.innerHTML = '<span class="mu-plain-text">foo</span>';
        const textNode = content.domNode!.firstChild!.firstChild!;

        const resolved = resolveEndpoint(textNode, 2);

        expect(resolved?.offset).toBe(2);
    });
});
