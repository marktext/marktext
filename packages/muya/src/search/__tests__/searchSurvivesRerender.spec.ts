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
        search.search('line');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        first.setCursor(2, 2);

        muya.setOptions({ softNewlineAsSpace: true }, true);

        expect(muya.editor.selection.anchorBlock?.text).toBe('line one');
        expect(muya.editor.selection.anchor?.offset).toBe(2);
        expect(highlightCount(muya)).toBe(1);
    });
});

// Toggling the parse-affecting `multilineBlockquote` stops `>>>` being text, so
// it changes the result set of an open search.
describe('search refresh after a parse-affecting toggle', () => {
    it('drops the active index when the parse removed every match', () => {
        const muya = bootMuya('>>>\nquote\n>>>\n');
        const search = muya.editor.searchModule;
        search.search('>>>');
        expect(search.matches.length).toBe(2);
        expect(search.index).toBe(0);

        muya.setOptions({ multilineBlockquote: true }, true);

        expect(search.matches.length).toBe(0);
        expect(search.index).toBe(-1);
        expect(highlightCount(muya)).toBe(0);
    });

    it('clamps an active index the new parse no longer has', () => {
        const muya = bootMuya('>>>\nquote\n>>>\n\nplain >>> here\n');
        const search = muya.editor.searchModule;
        search.search('>>>');
        expect(search.matches.length).toBe(3);
        search.find('next');
        search.find('next');
        expect(search.index).toBe(2);

        muya.setOptions({ multilineBlockquote: true }, true);

        // Only the plain paragraph still holds a `>>>`; the active match has to
        // land inside the refreshed result set instead of past its end.
        expect(search.matches.length).toBe(1);
        expect(search.index).toBe(0);
        expect(highlightCount(muya)).toBe(1);
    });

    it('notifies consumers with the refreshed result', () => {
        const muya = bootMuya('>>>\nquote\n>>>\n');
        const search = muya.editor.searchModule;
        search.search('>>>');

        const refreshed: unknown[] = [];
        muya.on('search-refreshed', payload => refreshed.push(payload));

        muya.setOptions({ multilineBlockquote: true }, true);

        expect(refreshed).toHaveLength(1);
        expect(refreshed[0]).toBe(search);
        expect(search.value).toBe('>>>');
    });
});
