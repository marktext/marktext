// @vitest-environment happy-dom

import type Format from '../format';
import { afterEach, expect, it, vi } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../__tests__/muyaHarness';

afterEach(() => vi.restoreAllMocks());
useMuyaHarness();

it('uses the rendered cursor when native selection has already left a token', () => {
    const muya = bootMuya('**hello**bar\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    block.setCursor(6, 6, true);
    block.setCursor(12, 12);

    vi.spyOn(block.domNode!, 'querySelector').mockImplementation(() => {
        throw new Error('Render decisions must not inspect the DOM');
    });

    expect(block.checkNeedRender()).toBe(true);
});

it('updates the rendered cursor after repainting outside the token', () => {
    const muya = bootMuya('**hello**bar\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    block.setCursor(6, 6, true);
    block.setCursor(12, 12, true);

    expect(block.checkNeedRender()).toBe(false);
});

it('clears the rendered cursor after repainting without a cursor', () => {
    const muya = bootMuya('**hello**bar\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    block.setCursor(6, 6, true);
    block.setCursor(12, 12);
    block.update();

    expect(block.checkNeedRender()).toBe(false);
});

it('keeps rendered offsets independent of a mutable render cursor', () => {
    const muya = bootMuya('**hello**bar\n');
    const block = muya.editor.scrollPage!.firstContentInDescendant()! as Format;
    const cursor = {
        block,
        anchor: {
            offset: 6,
        },
        focus: {
            offset: 6,
        },
    };
    block.update(cursor);
    cursor.anchor.offset = 12;
    cursor.focus.offset = 12;
    block.setCursor(12, 12);

    expect(block.checkNeedRender()).toBe(true);
});
