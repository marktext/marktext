// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// A cross-block copy/cut whose endpoint lands partway inside a trailing
// block-quote must carry only the selected head of the quote, not the whole
// quote. Regression: `appendPartialState` pushed the entire block-quote state
// for any block-quote endpoint, ignoring the caret offset — so selecting up to
// "gam|" inside `> gamma` copied the whole `> gamma`.

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

describe('cross-block copy into a trailing block-quote', () => {
    it('copies only the selected head of the quote, not the whole quote', () => {
        const muya = bootMuya('alpha\n\n- one\n- two\n\n> gamma\n');
        const scrollPage = muya.editor.scrollPage!;

        const alphaContent = scrollPage.firstContentInDescendant()!;
        const gammaContent = scrollPage.lastContentInDescendant()!;

        // anchor after "al" in alpha, focus after "gam" inside the quote
        stubCrossSelection(muya, alphaContent, 2, gammaContent, 3);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('pha\n\n- one\n- two\n\n> gam\n');
    });

    it('copies the selected tail of a leading block-quote, not the whole quote', () => {
        const muya = bootMuya('> alpha\n\n- one\n- two\n\ngamma\n');
        const scrollPage = muya.editor.scrollPage!;

        const alphaContent = scrollPage.firstContentInDescendant()!;
        const gammaContent = scrollPage.lastContentInDescendant()!;

        // anchor after "al" inside the leading quote, focus after "gam" in gamma
        stubCrossSelection(muya, alphaContent, 2, gammaContent, 3);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('> pha\n\n- one\n- two\n\ngam\n');
    });
});
