// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, expect, it, vi } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../__tests__/muyaHarness';
import { getNodeAndOffset } from '../../../selection/dom';

afterEach(() => vi.restoreAllMocks());
useMuyaHarness();

function moveNativeCaret(block: Format, offset: number) {
    const point = getNodeAndOffset(block.domNode!, offset);
    document.getSelection()!.collapse(point.node, point.offset);
    block.muya.editor.selection.syncTextSelection();
}

it('still detects a token exit after reading the current native selection', () => {
    const muya = bootMuya('**hello**bar\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    block.setCursor(6, 6, true);
    moveNativeCaret(block, 12);
    const state = muya.getSelectionState();
    expect(state?.kind).toBe('text');
    if (state?.kind === 'text')
        expect(state.anchor.offset).toBe(12);

    vi.spyOn(block.domNode!, 'querySelector').mockImplementation(() => {
        throw new Error('Render decisions must not inspect the DOM');
    });
    expect(block.checkNeedRender()).toBe(true);
});

it('repaints on keyup after native synchronization and then advances the applied endpoints', () => {
    const muya = bootMuya('**hello**bar\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    block.setCursor(6, 6, true);
    moveNativeCaret(block, 12);
    const update = vi.spyOn(block, 'update');

    block.keyupHandler();

    expect(update).toHaveBeenCalledTimes(1);
    expect(block.checkNeedRender()).toBe(false);
});

it('does not repaint a plain-text caret movement', () => {
    const muya = bootMuya('hello world\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    block.setCursor(6, 6, true);
    moveNativeCaret(block, 11);
    const update = vi.spyOn(block, 'update');

    block.keyupHandler();

    expect(update).not.toHaveBeenCalled();
    expect(block.getCursor()?.anchor.offset).toBe(11);
});
