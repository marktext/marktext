// @vitest-environment happy-dom

import type { IOrderListState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { SelectionDirection } from '../../selection/types';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function list(text: string): IOrderListState {
    return {
        name: 'order-list',
        meta: { start: 1, loose: false, delimiter: '()', style: 'lower-roman' },
        children: [{ name: 'list-item', children: [{ name: 'paragraph', text }] }],
    };
}

// Copy everything in a document of two adjacent lists in the same style.
function copyBothLists(fancyLists: boolean) {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: '', fancyLists } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    muya.setContent([list('x'), list('y')]);

    const scrollPage = muya.editor.scrollPage!;
    const first = scrollPage.firstContentInDescendant()!;
    const last = scrollPage.lastContentInDescendant()!;
    muya.editor.selection.getTextSelection = () => ({
        anchor: { offset: 0, block: first, path: first.path },
        focus: { offset: last.text.length, block: last, path: last.path },
        isCollapsed: false,
        isSelectionInSameBlock: false,
        direction: SelectionDirection.FORWARD,
    });

    return muya.editor.clipboard.getClipboardData().text;
}

describe('copying fancy lists', () => {
    it('ends the first list with a comment, as a save does', () => {
        expect(copyBothLists(true)).toBe('(i) x\n\n<!-- -->\n\n(i) y\n');
    });

    it('writes no separator while fancy lists are off', () => {
        expect(copyBothLists(false)).toBe('(i) x\n(i) y\n');
    });
});
