// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';
import { ParagraphFrontMenu } from '../ui/paragraphFrontMenu';

// Resetting a list/blockquote to paragraphs must preserve every item/line.
// `resetToParagraph` is the shared engine path used both by the command
// palette/menu `reset-to-paragraph` command and by the paragraph front menu
// when the user clicks the already-active list type (toggle the list off).

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

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

function firstOutmostBlock(muya: Muya): Parent {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as Content;
    return content.outMostBlock as Parent;
}

describe('muya.resetToParagraph(block)', () => {
    it('unwraps a bullet list into separate paragraphs, preserving every item', async () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        const list = firstOutmostBlock(muya);
        expect(list.blockName).toBe('bullet-list');

        muya.resetToParagraph(list);

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(3);
            expect(state.every(b => b.name === 'paragraph')).toBe(true);
        });
        const md = muya.getMarkdown();
        expect(md).toContain('one');
        expect(md).toContain('two');
        expect(md).toContain('three');
    });

    it('unwraps a blockquote into separate paragraphs', async () => {
        const muya = bootMuya('> line one\n>\n> line two\n');
        const quote = firstOutmostBlock(muya);
        expect(quote.blockName).toBe('block-quote');

        muya.resetToParagraph(quote);

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(2);
            expect(state.every(b => b.name === 'paragraph')).toBe(true);
        });
    });
});

describe('paragraph front menu — clicking the active list type unwraps the list', () => {
    it('bullet list -> bullet-list item unwraps into paragraphs', async () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        const list = firstOutmostBlock(muya);
        expect(list.blockName).toBe('bullet-list');

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = list;
        menu.selectItem(new Event('click'), { label: 'bullet-list' });

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(3);
            expect(state.every(b => b.name === 'paragraph')).toBe(true);
        });
    });
});
