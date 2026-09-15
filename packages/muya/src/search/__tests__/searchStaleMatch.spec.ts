// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

describe('search with matches whose blocks left the document (#5163)', () => {
    it('closing the search with selectHighlight skips a detached active match', () => {
        const muya = bootMuya('# foo\n\nbar\n');
        const search = muya.editor.searchModule;
        search.search('foo');
        expect(search.matches.length).toBe(1);

        search.matches[0].block.parent!.remove();

        expect(() => search.search('', { selectHighlight: true })).not.toThrow();
        expect(search.matches).toEqual([]);
    });
});
