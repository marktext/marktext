// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

// Coverage for the Search module (src/search/index.ts) — the find/replace
// engine the desktop "Find in document" / "Find and replace" surfaces drive.
// The module lives at muya.editor.searchModule and exposes search(value, opts),
// find('previous'|'next'), and replace(value, {isSingle, isRegexp}). Each match
// renders a highlight span into the live DOM: the active match gets
// `span.mu-highlight`, every other match gets `span.mu-selection`
// (Renderer.getHighlightClassName). block.update() patches the inline DOM
// synchronously, so the spans are queryable right after the call.

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

function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    return first;
}

function highlightCount(muya: Muya): number {
    return muya.domNode.querySelectorAll('span.mu-highlight').length;
}

function selectionCount(muya: Muya): number {
    return muya.domNode.querySelectorAll('span.mu-selection').length;
}

describe('search.search()', () => {
    it('collects every match and highlights the first (one mu-highlight, rest mu-selection)', () => {
        const muya = bootMuya('apple banana apple cherry\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('apple');

        expect(search.matches.length).toBe(2);
        expect(search.index).toBe(0);
        // First match active, second selected.
        expect(search.matches[0].start).toBe(0);
        expect(search.matches[1].start).toBe(13);

        // Active match -> span.mu-highlight, the remaining match -> span.mu-selection.
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(search.matches.length - 1);
        expect(selectionCount(muya)).toBe(1);
    });

    it('clears highlights when searching for an empty value', () => {
        const muya = bootMuya('apple banana apple cherry\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('apple');
        expect(highlightCount(muya)).toBe(1);

        search.search('');
        expect(search.matches.length).toBe(0);
        expect(search.index).toBe(-1);
        expect(highlightCount(muya)).toBe(0);
        expect(selectionCount(muya)).toBe(0);
    });
});

describe('search.search() — selectHighlight restores the editor cursor', () => {
    it('places the cursor on the last active match when closing the search bar (empty value + selectHighlight)', () => {
        const muya = bootMuya('apple banana apple cherry\n');
        const block = placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('apple');
        // Move the active match to the second "apple" (offset 13-18).
        search.find('next');
        expect(search.index).toBe(1);

        // Closing the search bar empties the search with selectHighlight, which
        // must drop the editor cursor back onto the last active match so the
        // user can keep typing where the highlight was.
        search.search('', { selectHighlight: true });

        expect(highlightCount(muya)).toBe(0);
        expect(muya.editor.activeContentBlock).toBe(block);
        expect(muya.editor.selection.anchorBlock).toBe(block);
        expect(muya.editor.selection.focusBlock).toBe(block);
        expect(muya.editor.selection.anchor!.offset).toBe(13);
        expect(muya.editor.selection.focus!.offset).toBe(18);
    });
});

describe('search.find() — cursor navigation across matches', () => {
    it('wraps forward 0 -> 1 -> 2 -> 0 and backward 0 -> 2, moving the active mu-highlight', () => {
        const muya = bootMuya('x and x and x\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('x');
        expect(search.matches.length).toBe(3);
        expect(search.index).toBe(0);
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);

        // next three times wraps forward: 1, 2, 0
        search.find('next');
        expect(search.index).toBe(1);
        search.find('next');
        expect(search.index).toBe(2);
        search.find('next');
        expect(search.index).toBe(0);

        // The single active highlight follows the index.
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);

        // previous from index 0 wraps backward to the last match (2).
        search.find('previous');
        expect(search.index).toBe(2);
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);
    });
});

describe('search.replace() — replace all across multiple blocks', () => {
    it('replaces every occurrence of the needle in every block (replace-all flush)', async () => {
        const muya = bootMuya('x foo x foo end\n\n# foo here\n\n- foo\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('foo');
        // Two in the paragraph, one in the heading, one in the list item.
        expect(search.matches.length).toBe(4);

        search.replace('BAR', { isSingle: false, isRegexp: false });

        // block.text writes are batched into the json state on the next rAF, so
        // wait for getMarkdown (which serializes the json state) to settle.
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).not.toContain('foo');
        });

        const md = muya.getMarkdown();
        // Paragraph with two occurrences plus trailing text survives intact.
        expect(md).toContain('x BAR x BAR end');
        // Heading block.
        expect(md).toContain('# BAR here');
        // List item block.
        expect(md).toContain('- BAR');

        // A fresh search for the old needle finds nothing.
        search.search('foo');
        expect(search.matches.length).toBe(0);
    });
});
