// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for muya.replaceCurrentWordInlineUnsafe — the spellcheck word
// replacement API added for the muyajs -> @muyajs/core desktop migration.
// Legacy muyajs exposed `_replaceCurrentWordInlineUnsafe(word, replacement)`;
// the desktop spell checker calls it when the user picks a suggestion from the
// misspelled-word context menu (Chromium has already selected the whole word).
//
// The method finds the word at the cursor, asserts it matches `word`, replaces
// it inline through the text setter (which dispatches a json edit op), and
// places the cursor after the replacement. State flushes on rAF, so markdown
// assertions wait via vi.waitFor.

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

// Place the cursor inside the first content block at `offset` and mark it as
// the active block — mirrors the editor state after a click lands the caret.
function placeCursorAt(muya: Muya, offset: number): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    first.setCursor(offset, offset, true);
    return first;
}

describe('muya.replaceCurrentWordInlineUnsafe()', () => {
    it('replaces the misspelled word at the cursor and updates markdown', async () => {
        const muya = bootMuya('teh quick brown fox\n');
        // Cursor sits inside `teh`.
        placeCursorAt(muya, 1);

        const ok = muya.replaceCurrentWordInlineUnsafe('teh', 'the');
        expect(ok).toBe(true);

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('the quick brown fox');
        });
        expect(muya.getMarkdown()).not.toContain('teh');
    });

    it('replaces a word in the middle of the line', async () => {
        const muya = bootMuya('the quikc brown fox\n');
        // Cursor inside `quikc` (offset of the `i`).
        placeCursorAt(muya, 'the qu'.length);

        const ok = muya.replaceCurrentWordInlineUnsafe('quikc', 'quick');
        expect(ok).toBe(true);

        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('the quick brown fox');
        });
    });

    it('places the cursor after the replacement', () => {
        const muya = bootMuya('teh end\n');
        const block = placeCursorAt(muya, 0);

        muya.replaceCurrentWordInlineUnsafe('teh', 'the');

        const cursor = block.getCursor();
        expect(cursor).not.toBeNull();
        // `the` is 3 chars, so the caret should sit at offset 3.
        expect(cursor!.start.offset).toBe(3);
        expect(cursor!.end.offset).toBe(3);
    });

    it('is a no-op when the word at the cursor does not match (Chromium mismatch)', async () => {
        const muya = bootMuya('teh quick\n');
        placeCursorAt(muya, 1);

        const ok = muya.replaceCurrentWordInlineUnsafe('different', 'the');
        expect(ok).toBe(false);

        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(muya.getMarkdown()).toContain('teh quick');
    });

    it('returns false when there is no active content block', () => {
        const muya = bootMuya('teh quick\n');
        muya.editor.activeContentBlock = null;

        expect(muya.replaceCurrentWordInlineUnsafe('teh', 'the')).toBe(false);
    });

    it('returns false when there is no cursor in the active block', () => {
        const muya = bootMuya('teh quick\n');
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first;
        // No selection set — getCursor() returns null.
        document.getSelection()?.removeAllRanges();

        expect(muya.replaceCurrentWordInlineUnsafe('teh', 'the')).toBe(false);
    });
});
