// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for muya.updateParagraph — the block-type conversions the desktop
// Paragraph menu drives (added for the muyajs -> @muyajs/core migration). It
// accepts the marktext/muyajs label vocabulary and maps onto muya's
// replaceBlockByLabel + list/heading handling. State flushes on rAF, so
// assertions wait via vi.waitFor.

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
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    return first;
}

// eslint-disable-next-line ts/no-explicit-any
function firstBlock(muya: Muya): any {
    return muya.getState()[0];
}

describe('muya.updateParagraph()', () => {
    it('turns a paragraph into a heading (text preserved)', async () => {
        const muya = bootMuya('hello world\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('heading 1');
        await vi.waitFor(() => {
            const b = firstBlock(muya);
            expect(b.name).toBe('atx-heading');
            expect(b.meta.level).toBe(1);
        });
        expect(muya.getMarkdown()).toContain('hello world');
    });

    it('reset-to-paragraph turns a heading back into a paragraph', async () => {
        const muya = bootMuya('## a heading\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('reset-to-paragraph');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('paragraph');
        });
    });

    it('upgrade heading cycles paragraph -> h6 and h2 -> h1', async () => {
        const muya = bootMuya('plain\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('upgrade heading');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('atx-heading');
            expect(firstBlock(muya).meta.level).toBe(6);
        });

        const muya2 = bootMuya('## two\n');
        placeCursorOnFirstBlock(muya2);
        muya2.updateParagraph('upgrade heading');
        await vi.waitFor(() => {
            expect(firstBlock(muya2).meta.level).toBe(1);
        });
    });

    it('degrade heading lowers h1 -> h2', async () => {
        const muya = bootMuya('# one\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('degrade heading');
        await vi.waitFor(() => {
            expect(firstBlock(muya).meta.level).toBe(2);
        });
    });

    it('turns a paragraph into a blockquote', async () => {
        const muya = bootMuya('quote me\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('blockquote');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('block-quote');
        });
    });

    it('turns a paragraph into a bullet list', async () => {
        const muya = bootMuya('item\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('bullet-list');
        });
    });

    it('converts a bullet list to an ordered list, preserving items', async () => {
        const muya = bootMuya('- one\n- two\n');
        placeCursorOnFirstBlock(muya);
        expect(firstBlock(muya).name).toBe('bullet-list');
        muya.updateParagraph('ol-order');
        await vi.waitFor(() => {
            const b = firstBlock(muya);
            expect(b.name).toBe('order-list');
            expect(b.children.length).toBe(2);
        });
    });

    it('toggles loose/tight on the current list', async () => {
        const muya = bootMuya('- a\n- b\n');
        placeCursorOnFirstBlock(muya);
        const before = firstBlock(muya).meta.loose;
        muya.updateParagraph('loose-list-item');
        await vi.waitFor(() => {
            expect(firstBlock(muya).meta.loose).toBe(!before);
        });
    });

    it('keeps the cursor in the same list item when toggling loose/tight', async () => {
        const muya = bootMuya('- a\n- b\n');
        const list = muya.editor.scrollPage!.firstContentInDescendant()!.outMostBlock!;
        const second = list.lastContentInDescendant()!;
        // Caret at the end of the SECOND item ('b').
        second.setCursor(1, 1, true);
        expect(muya.editor.activeContentBlock).toBe(second);

        muya.updateParagraph('loose-list-item');
        await vi.waitFor(() => {
            expect(firstBlock(muya).meta.loose).toBe(true);
        });

        // The caret must stay in the second item at the same offset, not jump
        // back to the first item at offset 0.
        expect(muya.editor.activeContentBlock?.text).toBe('b');
        expect(muya.editor.selection.anchor?.offset).toBe(1);
    });

    it('keeps a multi-item selection spanning list items when toggling loose/tight', async () => {
        const muya = bootMuya('1. a\n2. b\n3. c\n');
        const list = muya.editor.scrollPage!.firstContentInDescendant()!.outMostBlock!;
        const first = list.firstContentInDescendant()!;
        const third = list.lastContentInDescendant()!;

        // Simulate Chromium reporting a live selection spanning item 1 ('a') to
        // item 3 ('c'). happy-dom's Selection.extend can't build a cross-node
        // range, so the real menu scenario (getSelection returns the range) is
        // stubbed here; the assertions below exercise the path re-resolution.
        const liveSelection = {
            anchor: { offset: 0, block: first, path: first.path },
            focus: { offset: 1, block: third, path: third.path },
            isCollapsed: false,
            isSelectionInSameBlock: false,
            direction: 'forward',
            type: 'Range',
        };
        vi.spyOn(muya.editor.selection, 'getSelection').mockReturnValue(liveSelection as never);
        muya.editor.activeContentBlock = third;

        muya.updateParagraph('loose-list-item');
        await vi.waitFor(() => {
            expect(firstBlock(muya).meta.loose).toBe(true);
        });

        // The selection must still span the first and third items, not collapse
        // to a single item.
        const sel = muya.editor.selection;
        expect(sel.anchorBlock?.text).toBe('a');
        expect(sel.focusBlock?.text).toBe('c');
        expect(sel.anchorBlock).not.toBe(sel.focusBlock);
        expect(sel.anchor?.offset).toBe(0);
        expect(sel.focus?.offset).toBe(1);
    });

    it('maps the command-palette ol-bullet label to an ordered list', async () => {
        const muya = bootMuya('item\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ol-bullet');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('order-list');
        });
    });

    it('reset-to-paragraph unwraps a list into paragraphs, preserving items', async () => {
        const muya = bootMuya('- one\n- two\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('reset-to-paragraph');
        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(2);
            expect(state.every(b => b.name === 'paragraph')).toBe(true);
        });
        expect(muya.getMarkdown()).toContain('one');
        expect(muya.getMarkdown()).toContain('two');
    });

    it('selecting the active list type toggles the list off, preserving items', async () => {
        const muya = bootMuya('- a\n- b\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            const state = muya.getState();
            expect(state.length).toBe(2);
            expect(state.every(b => b.name === 'paragraph')).toBe(true);
        });
    });

    it('does not convert a non-empty paragraph to hr (content guard)', async () => {
        const muya = bootMuya('keep me\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('hr');
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        expect(firstBlock(muya).name).toBe('paragraph');
        expect(muya.getMarkdown()).toContain('keep me');
    });

    // G4 regression: the plain 'paragraph' menu item must not collapse a list /
    // blockquote into a single paragraph built from the first item's text. Legacy
    // muyajs treated this as a no-op inside a container; the migrated engine used
    // to fall through to replaceBlockByLabel on the whole container and silently
    // lose every item but the first.
    it('\'paragraph\' on a 2-item bullet list is a no-op, preserving both items', async () => {
        const muya = bootMuya('- one\n- two\n');
        placeCursorOnFirstBlock(muya);
        expect(firstBlock(muya).name).toBe('bullet-list');
        muya.updateParagraph('paragraph');
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('bullet-list');
        const md = muya.getMarkdown();
        expect(md).toContain('one');
        expect(md).toContain('two');
    });

    it('\'paragraph\' on a 2-line blockquote is a no-op, preserving both lines', async () => {
        const muya = bootMuya('> a\n>\n> b\n');
        placeCursorOnFirstBlock(muya);
        expect(firstBlock(muya).name).toBe('block-quote');
        muya.updateParagraph('paragraph');
        await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
        const state = muya.getState();
        expect(state.length).toBe(1);
        expect(state[0].name).toBe('block-quote');
        const md = muya.getMarkdown();
        expect(md).toContain('a');
        expect(md).toContain('b');
    });

    it('\'paragraph\' still converts a leaf block (heading) back to a paragraph', async () => {
        const muya = bootMuya('## a heading\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('paragraph');
        await vi.waitFor(() => {
            expect(firstBlock(muya).name).toBe('paragraph');
        });
        expect(muya.getMarkdown()).toContain('a heading');
    });

    // G4 follow-up: the leaf — not the whole container — is the conversion
    // target. A heading nested in a list item must convert to a paragraph in
    // place, leaving the list (and the rest of its items) untouched. The earlier
    // "no-op on any list/blockquote container" guard wrongly suppressed this.
    it('\'paragraph\' converts a heading inside a list item, leaving the list intact', async () => {
        const muya = bootMuya('- # heading in item\n- second item\n');
        // Cursor lands on the heading's content inside the first list item.
        placeCursorOnFirstBlock(muya);
        expect(firstBlock(muya).name).toBe('bullet-list');

        muya.updateParagraph('paragraph');

        await vi.waitFor(() => {
            const list = firstBlock(muya);
            // The first item's heading became a paragraph...
            expect(list.children[0].children[0].name).toBe('paragraph');
        });

        const list = firstBlock(muya);
        // ...and the container is still a 2-item bullet list — nothing collapsed.
        expect(list.name).toBe('bullet-list');
        expect(list.children.length).toBe(2);
        const md = muya.getMarkdown();
        expect(md).toContain('heading in item');
        expect(md).toContain('second item');
        // The atx hash run is gone now that the heading is a plain paragraph.
        expect(md).not.toContain('# heading in item');
    });
});
