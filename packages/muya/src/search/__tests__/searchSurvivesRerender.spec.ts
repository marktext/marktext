// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// A full re-render — `setOptions(options, true)`, `locale()` — rebuilds every
// block, so `Muya._forceRender()` re-runs the active search afterwards. Before
// #5651 the find bar kept its count while the highlight vanished, because the
// remembered matches pointed at the discarded blocks.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
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

function highlightCount(muya: Muya): number {
    return muya.domNode.querySelectorAll('span.mu-highlight').length;
}

function selectionCount(muya: Muya): number {
    return muya.domNode.querySelectorAll('span.mu-selection').length;
}

describe('search highlight survives a full re-render (#5651)', () => {
    it('keeps a word search highlighted across setOptions(..., true)', () => {
        const muya = bootMuya('line one\nline two\nline three\n');
        const search = muya.editor.searchModule;
        search.search('line');
        expect(search.matches.length).toBe(3);
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);

        muya.setOptions({ softNewlineAsSpace: true }, true);

        expect(search.matches.length).toBe(3);
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);
    });

    it('re-highlights the rebuilt blocks, not the discarded ones', () => {
        const muya = bootMuya('line one\nline two\nline three\n');
        const search = muya.editor.searchModule;
        search.search('line');
        const before = search.matches[0].block;

        muya.setOptions({ softNewlineAsSpace: true }, true);

        expect(search.matches[0].block).not.toBe(before);
        expect(search.matches[0].block.domNode?.isConnected).toBe(true);
    });

    it('keeps the active match index across the re-render', () => {
        const muya = bootMuya('line one\n\nline two\n\nline three\n');
        const search = muya.editor.searchModule;
        search.search('line');
        search.find('next');
        expect(search.index).toBe(1);

        muya.setOptions({ softNewlineAsSpace: true }, true);

        expect(search.index).toBe(1);
        expect(search.matches[search.index].block.text).toBe('line two');
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);
    });

    it('does not resurrect a find bar that was closed (empty query)', () => {
        const muya = bootMuya('line one\nline two\n');
        const search = muya.editor.searchModule;
        search.search('line');
        search.search('');

        muya.setOptions({ softNewlineAsSpace: true }, true);

        expect(search.matches.length).toBe(0);
        expect(highlightCount(muya)).toBe(0);
        expect(selectionCount(muya)).toBe(0);
    });

    it('restores the caret even when its block also holds the active match', () => {
        const muya = bootMuya('line one\n\nline two\n\nline three\n');
        const search = muya.editor.searchModule;
        // Active match is in the first block, which the highlight re-render
        // patches — the caret must still end up where it was.
        search.search('line');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        // needUpdate=false: placing the caret must not itself re-render (and so
        // clear) the block the search just highlighted.
        first.setCursor(2, 2);

        muya.setOptions({ softNewlineAsSpace: true }, true);

        expect(muya.editor.selection.anchorBlock?.text).toBe('line one');
        expect(muya.editor.selection.anchor?.offset).toBe(2);
        expect(highlightCount(muya)).toBe(1);
    });
});
