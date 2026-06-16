// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

const hosts: HTMLElement[] = [];
beforeEach(() => {
    window.MUYA_VERSION = 'test';
});
afterEach(() => {
    while (hosts.length)
        hosts.pop()!.remove();
});
function boot(md: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: md } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    hosts.push(muya.domNode);
    return muya;
}
// Select a range spanning the first two top-level paragraphs.
function selectFirstTwoBlocks(muya: Muya) {
    const sp = muya.editor.scrollPage!;
    const first = sp.firstContentInDescendant()!;
    const second = sp.firstChild!.next!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = second;
    muya.editor.selection.setSelection(
        { offset: 0, block: first, path: first.path },
        { offset: second.text.length, block: second, path: second.path },
    );
}

describe('cross-block paragraph wrapping', () => {
    it('wraps selected paragraphs into a bullet list (one item per block)', async () => {
        const muya = boot('alpha\n\nbravo\n');
        selectFirstTwoBlocks(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('bullet-list');
            expect(s[0].children.length).toBe(2);
            expect(s[0].children[0].children[0].text).toBe('alpha');
            expect(s[0].children[1].children[0].text).toBe('bravo');
        });
    });

    it('wraps selected paragraphs into an ordered list', async () => {
        const muya = boot('alpha\n\nbravo\n');
        selectFirstTwoBlocks(muya);
        muya.updateParagraph('ol-order');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('order-list');
            expect(s[0].children.length).toBe(2);
        });
    });

    it('wraps selected paragraphs into a task list', async () => {
        const muya = boot('alpha\n\nbravo\n');
        selectFirstTwoBlocks(muya);
        muya.updateParagraph('ul-task');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('task-list');
            expect(s[0].children.length).toBe(2);
        });
    });

    it('wraps selected paragraphs into a single block-quote', async () => {
        const muya = boot('alpha\n\nbravo\n');
        selectFirstTwoBlocks(muya);
        muya.updateParagraph('blockquote');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('block-quote');
            expect(s[0].children.length).toBe(2);
            expect(s[0].children[0].text).toBe('alpha');
            expect(s[0].children[1].text).toBe('bravo');
        });
    });

    it('joins selected paragraphs into a single code block', async () => {
        const muya = boot('alpha\n\nbravo\n');
        selectFirstTwoBlocks(muya);
        muya.updateParagraph('pre');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(1);
            expect(s[0].name).toBe('code-block');
            const text = (s[0].text ?? '') as string;
            expect(text).toContain('alpha');
            expect(text).toContain('bravo');
        });
    });

    it('keeps the selection spanning the wrapped content after list wrap', async () => {
        const muya = boot('alpha\n\nbravo\n');
        selectFirstTwoBlocks(muya);
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('bullet-list');
        });
        // happy-dom collapses the live DOM selection, so assert via the cached
        // endpoints that setSelection records (the same ones the menu round-trip
        // relies on).
        const sel = muya.editor.selection;
        expect(sel.anchorBlock!.text).toBe('alpha');
        expect(sel.focusBlock!.text).toBe('bravo');
    });
});
