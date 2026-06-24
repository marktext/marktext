// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

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
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function placeCursorOnFirstContent(muya: Muya): void {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    first.setCursor(0, 0, true);
}

function secondBlockContent(muya: Muya): Format {
    const blocks: { firstContentInDescendant: () => Format }[] = [];
    (muya.editor.scrollPage as unknown as {
        children: { forEach: (cb: (b: { firstContentInDescendant: () => Format }) => void) => void };
    }).children.forEach(b => blocks.push(b));
    return blocks[1].firstContentInDescendant();
}

function undoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.undo.length;
}

describe('undo/redo of a coalesced paragraph→list + text edit', () => {
    it('restores the typed list-item text on redo', async () => {
        const muya = bootMuya('# anchor\n\nseed\n');

        const para = secondBlockContent(muya);
        para.text = '- ';
        para.checkInlineUpdate();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('- ');
            expect(undoDepth(muya)).toBe(1);
        });

        const listContent = secondBlockContent(muya);
        listContent.text = 'foo';
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('foo');
        });
        expect(undoDepth(muya)).toBe(1);

        placeCursorOnFirstContent(muya);
        muya.undo();
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).toContain('seed');
            expect(md).not.toContain('foo');
        });
        expect(muya.getMarkdown()).not.toContain('- ');

        placeCursorOnFirstContent(muya);
        muya.redo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('foo');
        });
    });

    it('undo/redo with the caret left inside the converted block does not crash', async () => {
        const muya = bootMuya('hello world\n\nx\n');

        const para = secondBlockContent(muya);
        para.setCursor(0, 0, true);
        para.text = '- ';
        para.checkInlineUpdate();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('- ');
        });

        const listContent = secondBlockContent(muya);
        listContent.setCursor(0, 0, true);
        listContent.text = 'foo';
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('foo');
        });

        muya.editor.history.cutoff();
        const listContent2 = secondBlockContent(muya);
        listContent2.setCursor(3, 3, true);
        listContent2.text = 'foo bar';
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('foo bar');
        });

        muya.undo();
        await vi.waitFor(() => expect(muya.getMarkdown()).not.toContain(' bar'));
        muya.undo();
        await vi.waitFor(() => expect(muya.getMarkdown()).not.toContain('foo'));

        muya.redo();
        await vi.waitFor(() => expect(muya.getMarkdown()).toContain('foo'));
        muya.redo();
        await vi.waitFor(() => expect(muya.getMarkdown()).toContain('foo bar'));

        const live = secondBlockContent(muya);
        expect((live as unknown as { text: string }).text).toBe('foo bar');
        expect((live as unknown as { blockName: string }).blockName).toContain('paragraph');
    });
});
