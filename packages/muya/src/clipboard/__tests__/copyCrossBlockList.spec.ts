// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// A cross-block copy/cut whose endpoint lands partway inside a list item must
// carry only the selected portion of that item, not the whole item. Regression:
// the list branch of `appendPartialState` sliced list items by index but never
// truncated the boundary item's text — so selecting up to "ba|" in `- bar`
// copied the whole `- bar`.

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

describe('cross-block copy into a trailing list', () => {
    it('copies only the selected head of the last list item, not the whole item', () => {
        const muya = bootMuya('foo\n\n- bar\n');
        const scrollPage = muya.editor.scrollPage!;

        const fooContent = scrollPage.firstContentInDescendant()!;
        const barContent = scrollPage.lastContentInDescendant()!;

        // anchor after "f" in foo, focus after "ba" inside the list item
        stubCrossSelection(muya, fooContent, 1, barContent, 2);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('oo\n\n- ba\n');
    });

    it('preserves earlier fully-selected items and truncates only the boundary item', () => {
        const muya = bootMuya('foo\n\n- one\n- two\n');
        const scrollPage = muya.editor.scrollPage!;

        const fooContent = scrollPage.firstContentInDescendant()!;
        const twoContent = scrollPage.lastContentInDescendant()!;

        // anchor after "f" in foo, focus after "t" inside the second item
        stubCrossSelection(muya, fooContent, 1, twoContent, 1);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('oo\n\n- one\n- t\n');
    });
});

describe('cross-block copy out of a leading list', () => {
    it('copies the selected tail of the first list item', () => {
        const muya = bootMuya('- bar\n\nfoo\n');
        const scrollPage = muya.editor.scrollPage!;

        const barContent = scrollPage.firstContentInDescendant()!;
        const fooContent = scrollPage.lastContentInDescendant()!;

        // anchor after "ba" inside the list item, focus after "f" in foo
        stubCrossSelection(muya, barContent, 2, fooContent, 1);

        const { text } = muya.editor.clipboard.getClipboardData();

        expect(text).toBe('- r\n\nf\n');
    });
});
