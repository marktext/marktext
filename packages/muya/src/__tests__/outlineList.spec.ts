// @vitest-environment happy-dom

import type ParagraphContent from '../block/content/paragraphContent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { replaceBlockByLabel } from '../block/blockTransforms';
import { Muya } from '../muya';
import { ParagraphQuickInsertMenu } from '../ui/paragraphQuickInsertMenu';

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string, fancyLists: boolean): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, fancyLists } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    muya.editor.activeContentBlock = muya.editor.scrollPage!.firstContentInDescendant()!;
    return muya;
}

interface IMenuView {
    _block: ParagraphContent | null;
    _search: (text: string) => void;
    renderData: ParagraphQuickInsertMenu['renderData'];
}

function listBlockLabels(fancyLists: boolean) {
    const muya = bootMuya('\n', fancyLists);
    const menu = new ParagraphQuickInsertMenu(muya) as unknown as IMenuView;
    menu._block = muya.editor.scrollPage!.firstContentInDescendant() as unknown as ParagraphContent;
    menu._search('');

    return menu.renderData.find(section => section.name === 'list blocks')!.children.map(child => child.label);
}

describe('outline list', () => {
    it('is offered by the quick-insert menu only while fancy lists are on', () => {
        expect(listBlockLabels(false)).toEqual(['order-list', 'bullet-list', 'task-list']);
        expect(listBlockLabels(true)).toEqual(['order-list', 'outline-list', 'bullet-list', 'task-list']);
    });

    it('replaces the quick-insert paragraph with a list starting at I.', async () => {
        const muya = bootMuya('Introduction\n', true);
        const paragraph = muya.editor.scrollPage!.firstChild!;
        replaceBlockByLabel({ block: paragraph as never, muya, label: 'outline-list', text: 'Introduction' });

        await vi.waitFor(() => expect(muya.getMarkdown()).toBe('I.  Introduction\n'));
    });

    it('turns a paragraph into an outline from the paragraph menu', async () => {
        const muya = bootMuya('Introduction\n', true);
        muya.updateParagraph('ol-outline');

        await vi.waitFor(() => expect(muya.getMarkdown()).toBe('I.  Introduction\n'));
    });

    it('restyles the list at the cursor as an outline', async () => {
        const muya = bootMuya('1. one\n2. two\n', true);
        muya.updateParagraph('ol-outline');

        await vi.waitFor(() => expect(muya.getMarkdown()).toBe('I.  one\nII. two\n'));
    });

    it('wraps selected paragraphs into one outline', async () => {
        const muya = bootMuya('one\n\ntwo\n', true);
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        const second = muya.editor.scrollPage!.lastContentInDescendant()!;
        muya.editor.selection.setSelection(
            { offset: 0, block: first, path: first.path },
            { offset: second.text.length, block: second, path: second.path },
        );
        muya.updateParagraph('ol-outline');

        // `preferLooseListItem` defaults on, so the wrapped items are loose.
        await vi.waitFor(() => expect(muya.getMarkdown()).toBe('I.  one\n\nII. two\n'));
    });

    it('leaves the document alone while fancy lists are off', async () => {
        const muya = bootMuya('1. one\n2. two\n\nIntroduction\n', false);
        muya.updateParagraph('ol-outline');
        muya.editor.activeContentBlock = muya.editor.scrollPage!.lastContentInDescendant()!;
        muya.updateParagraph('ol-outline');

        await new Promise(resolve => requestAnimationFrame(resolve));
        expect(muya.getMarkdown()).toBe('1. one\n2. two\n\nIntroduction\n');
    });
});
