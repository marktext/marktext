// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// #1932 — switching tabs replaces the document via `Editor.setContent`, which
// rebuilds the block tree. The Search module kept its old `matches` (now
// pointing at detached blocks) and its old match count/value, so the search bar
// still showed the previous tab's results and "Find Next" operated on orphaned
// blocks. setContent must reset the search state.

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

describe('search resets when the document content is replaced (#1932)', () => {
    it('clears stale matches/index/value on setContent', () => {
        const muya = bootMuya('foo foo foo\n');
        const search = muya.editor.searchModule;
        search.search('foo');
        expect(search.matches.length).toBe(3);
        expect(search.value).toBe('foo');

        muya.editor.setContent('bar baz\n');

        expect(search.matches).toEqual([]);
        expect(search.index).toBe(-1);
        expect(search.value).toBe('');
    });

    it('find next after a tab switch is a no-op (no stale matches to act on)', () => {
        const muya = bootMuya('foo foo\n');
        const search = muya.editor.searchModule;
        search.search('foo');
        expect(search.matches.length).toBe(2);

        muya.editor.setContent('unrelated content\n');

        expect(() => search.find('next')).not.toThrow();
        expect(search.matches).toEqual([]);
        expect(search.index).toBe(-1);
    });

    it('a fresh search after setContent finds matches in the new document', () => {
        const muya = bootMuya('foo\n');
        const search = muya.editor.searchModule;
        search.search('foo');

        muya.editor.setContent('foo foo\n');
        search.search('foo');

        expect(search.matches.length).toBe(2);
        expect(search.matches.every(m => m.block.parent !== null)).toBe(true);
    });
});
