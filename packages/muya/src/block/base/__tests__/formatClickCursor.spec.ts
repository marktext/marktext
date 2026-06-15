// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';
import { SelectionDirection } from '../../../selection/types';

// Regression for the PR3 conversion of `Format.clickHandler` (and its siblings)
// from a direct `this.selection.setSelection(anchor, focus)` to
// `this.setCursor(anchor.offset, focus.offset)`. `setCursor(begin, end)` maps
// `begin -> anchor.offset` and `end -> focus.offset`, so a BACKWARD click-drag
// (anchor AFTER focus) must survive the conversion: the resulting selection has
// to stay backward with the original anchor / focus offsets, NOT get normalized
// to min/max.
//
// happy-dom collapses a non-collapsed selection whose two endpoints land in the
// same text node (anchorOffset and focusOffset both snap to the anchor), so a
// genuine backward selection cannot be planted through the native DOM and read
// back via `getSelection()`. We therefore exercise the conversion at the two
// deterministic seams it actually routes through:
//   1. `setCursor(begin, end)` itself — the method the handlers now call — must
//      keep `begin > end` backward, asserted via the engine-stored anchor/focus
//      (which the wrapper exposes directly, independent of the DOM readback).
//   2. `clickHandler` must forward `cursor.anchor.offset` / `cursor.focus.offset`
//      (NOT the normalized `start` / `end`) into `setCursor`, so a backward
//      `getCursor()` is passed through backward.

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

function firstBlock(muya: Muya): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    return content;
}

function directionOf(anchorOffset: number, focusOffset: number): SelectionDirection {
    return anchorOffset < focusOffset ? SelectionDirection.Forward : SelectionDirection.Backward;
}

function flushFrame(): Promise<void> {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

describe('setCursor preserves a backward selection (begin > end stays backward)', () => {
    it('setCursor(7, 2) leaves anchor 7 / focus 2 — a Backward selection, not min/max', () => {
        const muya = bootMuya('hello world\n');
        const content = firstBlock(muya);

        content.setCursor(7, 2);

        const { selection } = muya.editor;
        expect(selection.anchor!.offset).toBe(7);
        expect(selection.focus!.offset).toBe(2);
        expect(directionOf(selection.anchor!.offset, selection.focus!.offset)).toBe(
            SelectionDirection.Backward,
        );
    });

    it('setCursor(2, 7) leaves anchor 2 / focus 7 — a Forward selection', () => {
        const muya = bootMuya('hello world\n');
        const content = firstBlock(muya);

        content.setCursor(2, 7);

        const { selection } = muya.editor;
        expect(selection.anchor!.offset).toBe(2);
        expect(selection.focus!.offset).toBe(7);
        expect(directionOf(selection.anchor!.offset, selection.focus!.offset)).toBe(
            SelectionDirection.Forward,
        );
    });
});

describe('clickHandler forwards the backward anchor/focus (not normalized start/end) into setCursor', () => {
    it('a backward cursor (anchor 7, focus 2) is passed straight through to setCursor(7, 2)', async () => {
        const muya = bootMuya('hello world\n');
        const content = firstBlock(muya);

        // happy-dom can't hold a real backward DOM selection in a single text
        // node, so feed the handler a backward cursor directly. This is exactly
        // the value `getCursor()` returns for a right-to-left drag in a real
        // browser: `start`/`end` are normalized (2/7) but `anchor`/`focus` carry
        // the true direction (7/2).
        vi.spyOn(content, 'getCursor').mockReturnValue({
            start: { offset: 2 },
            end: { offset: 7 },
            anchor: { offset: 7, block: content as never, path: content.path },
            focus: { offset: 2, block: content as never, path: content.path },
            isCollapsed: false,
            isSelectionInSameBlock: true,
            direction: SelectionDirection.Backward,
            type: 'Range' as never,
        });
        const setCursorSpy = vi.spyOn(content, 'setCursor');

        // `isMouseEvent` is `'x' in event`; happy-dom's MouseEvent never exposes
        // `x`, and `event.target` is nulled once dispatch completes — so forge
        // both a real Element target and the `x`/`y` keys the guard checks.
        const event = new MouseEvent('click', { bubbles: true });
        const target = content.domNode!.querySelector('span') ?? content.domNode!;
        Object.defineProperty(event, 'target', { value: target, configurable: true });
        Object.assign(event, { x: 0, y: 0 });

        content.clickHandler(event);

        await flushFrame();

        await vi.waitFor(() => {
            // anchor.offset (7) -> begin, focus.offset (2) -> end. If the handler
            // had used start/end it would be (2, 7) and the backward drag would be
            // silently flipped to forward.
            expect(setCursorSpy).toHaveBeenCalledWith(7, 2);
        });
    });
});
