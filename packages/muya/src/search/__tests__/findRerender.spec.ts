// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type TreeNode from '../../block/base/treeNode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

// find('next'|'previous') only moves the active match, so it must re-render
// the blocks holding the old and the new active match, not every block with a
// match. Re-rendering all of them made each step O(matches) in large files.

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
    vi.restoreAllMocks();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function contentBlocks(muya: Muya): Content[] {
    const blocks: Content[] = [];
    muya.editor.scrollPage!.depthFirstTraverse((node: TreeNode) => {
        if (node.isContent())
            blocks.push(node as Content);
    });
    return blocks;
}

function spyUpdates(muya: Muya) {
    const blocks = contentBlocks(muya);
    const spies = blocks.map(block => vi.spyOn(block, 'update'));
    return () => blocks.filter((_, i) => spies[i].mock.calls.length > 0);
}

function activeTexts(muya: Muya): string[] {
    return [...muya.domNode.querySelectorAll('span.mu-highlight')].map(el => el.textContent ?? '');
}

describe('search.find() re-renders only the blocks whose active state changes', () => {
    const markdown = Array.from({ length: 20 }, (_, i) => `para ${i} needle`).join('\n\n');

    it('touches just the old and the new active block when moving between blocks', () => {
        const muya = bootMuya(markdown);
        const search = muya.editor.searchModule;
        search.search('needle');
        expect(search.matches.length).toBe(20);

        const touched = spyUpdates(muya);
        search.find('next');

        expect(search.index).toBe(1);
        expect(touched().map(block => block.text)).toEqual(['para 0 needle', 'para 1 needle']);
        expect(muya.domNode.querySelectorAll('span.mu-highlight').length).toBe(1);
        expect(muya.domNode.querySelectorAll('span.mu-selection').length).toBe(19);
    });

    it('touches one block when both matches are in the same block', () => {
        const muya = bootMuya('needle needle needle\n\nother needle\n');
        const search = muya.editor.searchModule;
        search.search('needle');

        const touched = spyUpdates(muya);
        search.find('next');

        expect(touched().map(block => block.text)).toEqual(['needle needle needle']);
        expect(muya.domNode.querySelectorAll('span.mu-highlight').length).toBe(1);
        expect(muya.domNode.querySelectorAll('span.mu-selection').length).toBe(3);
    });

    it('keeps highlights right when wrapping from the last match to the first', () => {
        const muya = bootMuya(markdown);
        const search = muya.editor.searchModule;
        search.search('needle');
        search.find('previous');
        expect(search.index).toBe(19);

        const touched = spyUpdates(muya);
        search.find('next');

        expect(search.index).toBe(0);
        expect(touched().map(block => block.text)).toEqual(['para 0 needle', 'para 19 needle']);
        expect(activeTexts(muya)).toEqual(['needle']);
        const active = muya.domNode.querySelector('span.mu-highlight')!;
        expect(active.closest('.mu-paragraph-content')!.textContent).toBe('para 0 needle');
    });
});
