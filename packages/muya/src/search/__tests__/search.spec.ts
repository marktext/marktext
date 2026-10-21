// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        expect(search.matches[0].start).toBe(0);
        expect(search.matches[1].start).toBe(13);

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

describe('search.search() — regexp \\n matches on line breaks', () => {
    it('bands every soft line break and keeps the lines split', () => {
        const muya = bootMuya('line one\nline two\nline three\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('\\n', { isRegexp: true });

        expect(search.matches.length).toBe(2);
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(1);

        const breaks = muya.domNode.querySelectorAll('span.mu-soft-line-break');
        expect(breaks.length).toBe(2);
        expect(Array.from(breaks).every(el => el.textContent === '\n')).toBe(true);
        expect((muya.domNode.textContent ?? '').split('\n').length).toBe(3);
    });

    it('bands every hard line break', () => {
        const muya = bootMuya('line one  \nline two  \nline three\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('\\n', { isRegexp: true });

        expect(search.matches.length).toBe(2);
        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(1);
        expect(muya.domNode.querySelectorAll('span.mu-hard-line-break').length).toBe(2);
    });
});

describe('search.search() — selectHighlight restores the editor cursor', () => {
    it('places the cursor on the last active match when closing the search bar (empty value + selectHighlight)', () => {
        const muya = bootMuya('apple banana apple cherry\n');
        const block = placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('apple');
        search.find('next');
        expect(search.index).toBe(1);

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

        search.find('next');
        expect(search.index).toBe(1);
        search.find('next');
        expect(search.index).toBe(2);
        search.find('next');
        expect(search.index).toBe(0);

        expect(highlightCount(muya)).toBe(1);
        expect(selectionCount(muya)).toBe(2);

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
        expect(search.matches.length).toBe(4);

        search.replace('BAR', { isSingle: false, isRegexp: false });

        // block.text writes are batched into the json state on the next rAF, so
        // wait for getMarkdown (which serializes the json state) to settle.
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).not.toContain('foo');
        });

        const md = muya.getMarkdown();
        expect(md).toContain('x BAR x BAR end');
        expect(md).toContain('# BAR here');
        expect(md).toContain('- BAR');

        search.search('foo');
        expect(search.matches.length).toBe(0);
    });
});

describe('search.replace() — regexp matches keep emoji whole', () => {
    it('replaces a whole emoji matched by a negated class', async () => {
        const muya = bootMuya('abc\u{1F642}\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('[^a-z]', { isRegexp: true });
        expect(search.matches.map(m => m.match)).toEqual(['\u{1F642}']);

        search.replace('x', { isSingle: true, isRegexp: true });

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe('abcx\n');
        });
    });

    it('replaces a ZWJ sequence as one character', async () => {
        const family = '\u{1F9D1}\u200D\u{1F9D1}\u200D\u{1F9D2}\u200D\u{1F9D2}';
        const muya = bootMuya(`${family}z\n`);
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('.', { isRegexp: true });
        expect(search.matches.map(m => m.match)).toEqual([family, 'z']);

        search.replace('x', { isSingle: false, isRegexp: true });

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe('xx\n');
        });
    });

    it('does not find a code point inside a ZWJ sequence with a literal search', () => {
        const muya = bootMuya('\u{1F9D1}\u200D\u{1F9D1}\u200D\u{1F9D2}\u200D\u{1F9D2}\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('\u{1F9D1}');
        expect(search.matches).toHaveLength(0);
    });
});

describe('search.replace() — a capture holding a dollar sign', () => {
    it('writes back a `$$` capture unchanged', async () => {
        const muya = bootMuya('The shell variable $$ holds the pid.\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('(\\$\\$)', { isRegexp: true });
        expect(search.matches.map(m => m.match)).toEqual(['$$']);

        search.replace('`$1`', { isSingle: true, isRegexp: true });

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe('The shell variable `$$` holds the pid.\n');
        });
    });
});

describe('search.replace() — regexp capture groups', () => {
    it('expands every match with its own groups when replacing all', async () => {
        const muya = bootMuya('a1 b2\n\nc3\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('([a-z])(\\d)', { isRegexp: true });
        search.find('next');

        search.replace('$2$1', { isSingle: false, isRegexp: true });

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe('1a 2b\n\n3c\n');
        });
    });

    it('expands only the active match when replacing one', async () => {
        const muya = bootMuya('a1 b2 c3\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('([a-z])(\\d)', { isRegexp: true });
        search.find('next');

        search.replace('$2$1', { isSingle: true, isRegexp: true });

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe('a1 2b c3\n');
        });
    });

    it('writes nothing for a group that did not take part in the match', async () => {
        const muya = bootMuya('color colour\n');
        placeCursorOnFirstBlock(muya);

        const search = muya.editor.searchModule;
        search.search('colo(u)?r', { isRegexp: true });

        search.replace('colo$1$1r', { isSingle: false, isRegexp: true });

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe('color colouur\n');
        });
    });
});
