// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// Copying a multi-leaf selection that stays inside a single list or block-quote
// must truncate both boundary items to the caret, not carry whole items / the
// whole quote. Regression: `collectSameOutMostBlockState` pushed the whole
// block-quote and sliced list items by index without truncating their text.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function stubCrossSelection(
    muya: Muya,
    anchorBlock: Content,
    anchorOffset: number,
    focusBlock: Content,
    focusOffset: number,
) {
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: anchorOffset, block: anchorBlock, path: anchorBlock.path },
        focus: { offset: focusOffset, block: focusBlock, path: focusBlock.path },
        isCollapsed: false,
        isSelectionInSameBlock: false,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
}

describe('copy within a single list', () => {
    it('truncates both boundary items and keeps fully-selected middle items', () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        const scrollPage = muya.editor.scrollPage!;

        const oneContent = scrollPage.firstContentInDescendant()!;
        const threeContent = scrollPage.lastContentInDescendant()!;

        // after "o" in "one" to after "th" in "three"
        stubCrossSelection(muya, oneContent, 1, threeContent, 2);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('- ne\n- two\n- th\n');
    });
});

describe('copy within a single block-quote', () => {
    it('truncates both boundary paragraphs, not the whole quote', () => {
        const muya = bootMuya('> alpha\n>\n> beta\n');
        const scrollPage = muya.editor.scrollPage!;

        const alphaContent = scrollPage.firstContentInDescendant()!;
        const betaContent = scrollPage.lastContentInDescendant()!;

        // after "al" in "alpha" to after "be" in "beta"
        stubCrossSelection(muya, alphaContent, 2, betaContent, 2);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('> pha\n>\n> be\n');
    });
});
