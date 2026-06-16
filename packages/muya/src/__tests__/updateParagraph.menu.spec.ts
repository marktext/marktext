// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

const bootedHosts: HTMLElement[] = [];
beforeEach(() => {
    window.MUYA_VERSION = 'test';
});
afterEach(() => {
    while (bootedHosts.length) bootedHosts.pop()!.remove();
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}
function placeCursorOnFirstBlock(muya: Muya) {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    first.setCursor(0, 0, true);
    return first;
}

describe('updateParagraph same-block menu model', () => {
    it('converts a non-empty paragraph to a heading in place (convertible)', async () => {
        const muya = bootMuya('hello world\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('heading 1');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(1);
            expect(s[0].name).toBe('atx-heading');
        });
    });

    it('inserts a new code block BELOW a non-empty paragraph (non-convertible, original kept)', async () => {
        const muya = bootMuya('hello\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('pre'); // 'pre' -> code-block; not in canTurnIntoMenu(paragraph)
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(2);
            expect(s[0].name).toBe('paragraph');
            expect((s[0] as { text: string }).text).toBe('hello');
            expect(s[1].name).toBe('code-block');
        });
    });

    it('replaces an EMPTY paragraph in place for a non-convertible type', async () => {
        const muya = bootMuya('\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('pre');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(1);
            expect(s[0].name).toBe('code-block');
        });
    });

    it('converts the list item paragraph (immediate), leaving the list intact', async () => {
        const muya = bootMuya('- item one\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('heading 1');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('bullet-list');
            expect((s[0] as { children: { children: { name: string }[] }[] }).children[0].children[0].name).toBe('atx-heading');
        });
    });
});
