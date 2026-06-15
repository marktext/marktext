// @vitest-environment happy-dom

import type { ISelection } from '../selection/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';
import { injectStateSentinels, locateSentinelOffsets } from '../selection/offsetCursor';
import { SelectionCaretType, SelectionDirection } from '../selection/types';

// PARITY (gap PG2 / Phase G — G7): `getCursorOffset` is the READ inverse of
// `setCursorByOffset`. It maps the live WYSIWYG block-key caret back to a
// source-mode (CodeMirror) `{ line, ch }` index cursor so toggling
// WYSIWYG -> source opens at the same caret. Legacy muyajs computed this in
// `ContentState.getMuyaIndexCursor`; `@muyajs/core` shipped only the WRITE
// direction until this was re-added.

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

describe('muya.getCursorOffset() (Phase G — G7)', () => {
    it('maps a collapsed caret in a paragraph to its {line, ch}', () => {
        const muya = bootMuya('first para\n\nsecond para\n\nthird para here\n');
        const third = muya.editor.scrollPage!.lastContentInDescendant()!;
        // Caret after "third " (offset 6) in the third paragraph.
        third.setCursor(6, 6, true);

        const cursor = muya.getCursorOffset();
        expect(cursor).not.toBeNull();
        // Lines: 0 first, 1 blank, 2 second, 3 blank, 4 third.
        expect(cursor!.anchor).toEqual({ line: 4, ch: 6 });
        expect(cursor!.focus).toEqual({ line: 4, ch: 6 });
        // The live document is untouched (no sentinel residue).
        expect(muya.getMarkdown()).not.toContain('mUyAcUrSoR');
    });

    it('maps a caret inside a heading (marker kept in content text)', () => {
        const muya = bootMuya('# Title\n\nbody text\n');
        const heading = muya.editor.scrollPage!.firstContentInDescendant()!;
        heading.setCursor(4, 4, true); // after "# Ti"

        const cursor = muya.getCursorOffset();
        expect(cursor).not.toBeNull();
        expect(cursor!.anchor).toEqual({ line: 0, ch: 4 });
    });

    it('round-trips with setCursorByOffset (set -> read returns the same offset)', () => {
        const muya = bootMuya('alpha\n\nbeta gamma\n\ndelta\n');
        const target = { line: 2, ch: 5 }; // inside "beta gamma" -> after "beta "
        const restored = muya.setCursorByOffset({ anchor: target, focus: target });
        expect(restored).toBe(true);

        const cursor = muya.getCursorOffset();
        expect(cursor).not.toBeNull();
        expect(cursor!.anchor).toEqual(target);
        expect(cursor!.focus).toEqual(target);
    });

    it('resolves a non-collapsed selection within a block to anchor/focus offsets', () => {
        // Asserted at the function level: happy-dom collapses a non-collapsed
        // DOM range across re-render, so we drive injectStateSentinels directly
        // (the resolver computes the sentinel-free anchor/focus offsets).
        const muya = bootMuya('hello world\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        const selection: ISelection = {
            anchor: { offset: 0, block, path: [0, 'text'] },
            focus: { offset: 5, block, path: [0, 'text'] },
            isCollapsed: false,
            isSelectionInSameBlock: true,
            direction: SelectionDirection.Forward,
            type: SelectionCaretType.Range,
        };
        const sentinelState = injectStateSentinels(muya.getState(), selection);
        expect(sentinelState).not.toBeNull();
        const md = muya.editor.jsonState.getMarkdownFromState(sentinelState!);
        const cursor = locateSentinelOffsets(md);
        expect(cursor).not.toBeNull();
        expect(cursor!.anchor).toEqual({ line: 0, ch: 0 });
        expect(cursor!.focus).toEqual({ line: 0, ch: 5 });
    });

    it('resolves a BACKWARD same-block selection (anchor after focus)', () => {
        const muya = bootMuya('hello world\n');
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        const selection: ISelection = {
            anchor: { offset: 9, block, path: [0, 'text'] }, // after "hello wor"
            focus: { offset: 2, block, path: [0, 'text'] }, //  after "he"
            isCollapsed: false,
            isSelectionInSameBlock: true,
            direction: SelectionDirection.Backward,
            type: SelectionCaretType.Range,
        };
        const sentinelState = injectStateSentinels(muya.getState(), selection);
        expect(sentinelState).not.toBeNull();
        const md = muya.editor.jsonState.getMarkdownFromState(sentinelState!);
        const cursor = locateSentinelOffsets(md);
        expect(cursor).not.toBeNull();
        // Sentinel-free offsets recovered regardless of injection order.
        expect(cursor!.anchor).toEqual({ line: 0, ch: 9 });
        expect(cursor!.focus).toEqual({ line: 0, ch: 2 });
    });

    it('returns null when there is no selection', () => {
        const muya = bootMuya('text\n');
        document.getSelection()?.removeAllRanges();
        expect(muya.getCursorOffset()).toBeNull();
    });
});
