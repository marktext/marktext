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

// Regression for #4686: the front menu kept a reference to the block it was
// opened on (`_block`) and hid itself on a deferred `setTimeout`, so a rapid
// second click (a real double-click) ran a second action on the same target.
// When the first action removed/replaced the block, the second dereferenced a
// null `parent` deep in `_unwrapToParagraphs` and crashed the renderer with
// "Cannot read properties of null (reading 'insertAfter')". The fix makes a
// single menu open perform at most one action.
describe('paragraph front menu — a single menu open performs at most one action (#4686)', () => {
    it('a rapid second click runs no further action (double-click is single-shot)', async () => {
        const muya = bootMuya('hello\n');
        const para = firstOutmostBlock(muya);
        expect(para.blockName).toBe('paragraph');

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = para;

        // Double "duplicate": the first inserts one copy; the second click
        // (before the menu's deferred hide) must be ignored, not insert a
        // second copy.
        menu.selectItem(new Event('click'), { label: 'duplicate' });
        menu.selectItem(new Event('click'), { label: 'duplicate' });

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(2); // original + exactly one duplicate
        });
    });

    it('ignores a second turn-into after the first action detached the block', async () => {
        const muya = bootMuya('- one\n- two\n- three\n');
        const list = firstOutmostBlock(muya);
        expect(list.blockName).toBe('bullet-list');

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = list;

        // Convert bullet -> order: `replaceWith` detaches the original bullet
        // list, but the menu still holds it in `_block`.
        menu.selectItem(new Event('click'), { label: 'order-list' });

        expect(() =>
            menu.selectItem(new Event('click'), { label: 'bullet-list' }),
        ).not.toThrow();

        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(1);
            expect(state[0].name).toBe('order-list');
        });
    });

    it('toggling the active list type twice does not crash', () => {
        const muya = bootMuya('- one\n- two\n');
        const list = firstOutmostBlock(muya);

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = list;

        // First toggle unwraps the list back to paragraphs (removes the list).
        menu.selectItem(new Event('click'), { label: 'bullet-list' });

        // The stale `_block` now points at the removed list; toggling again
        // must be a no-op, not a crash.
        expect(() =>
            menu.selectItem(new Event('click'), { label: 'bullet-list' }),
        ).not.toThrow();
    });

    // The deterministic real-world repro: an external command (the app menu bar)
    // unwraps the list while the front menu stays open, detaching `_block`. The
    // next front-menu click then targets the detached block. This must hold for
    // EVERY item — Duplicate/New reparent via `block.parent!.insertAfter`, which
    // the engine-level `_unwrapToParagraphs` guard does not cover.
    it('ignores a Duplicate click after an external command unwrapped the open block', () => {
        const muya = bootMuya('- one\n- two\n');
        const list = firstOutmostBlock(muya);

        const menu = new ParagraphFrontMenu(muya, {});
        (menu as unknown as { _block: Parent })._block = list;

        // Simulate the menu bar's "reset to paragraph": unwraps + removes the
        // list, but leaves the front menu open with its now-detached `_block`.
        muya.resetToParagraph(list);

        expect(() =>
            menu.selectItem(new Event('click'), { label: 'duplicate' }),
        ).not.toThrow();
    });
});

describe('muya.resetToParagraph(block) — detached block (#4686)', () => {
    it('is a no-op on a list already removed from the document', () => {
        const muya = bootMuya('- one\n- two\n');
        const list = firstOutmostBlock(muya);
        list.remove(); // detach: parent -> null, children left intact

        expect(() => muya.resetToParagraph(list)).not.toThrow();
    });
});
