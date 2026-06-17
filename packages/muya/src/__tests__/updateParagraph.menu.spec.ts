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
function placeCursorOnLastContent(muya: Muya) {
    const last = muya.editor.scrollPage!.lastContentInDescendant()!;
    muya.editor.activeContentBlock = last as never;
    last.setCursor(0, 0, true);
    return last;
}
// eslint-disable-next-line ts/no-explicit-any
function hasName(state: any[], name: string): boolean {
    return state.some(b => b.name === name || (Array.isArray(b.children) && hasName(b.children, name)));
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

    it('toggles an enclosing code block back to a paragraph instead of nesting one', async () => {
        const muya = bootMuya('```\ncode here\n```\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('pre');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(1);
            expect(s[0].name).toBe('paragraph');
            expect((s[0] as { text: string }).text).toContain('code here');
        });
    });

    it('preserves the caret offset across paragraph -> list -> paragraph', async () => {
        const muya = bootMuya('hello world\n');
        const content = placeCursorOnFirstBlock(muya);
        content.setCursor(3, 3, true);

        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('bullet-list'));
        expect(muya.editor.selection.anchor?.offset).toBe(3);

        muya.updateParagraph('ul-bullet'); // toggle back to paragraph
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('paragraph'));
        expect(muya.editor.selection.anchor?.offset).toBe(3);
    });

    it('preserves a range selection across paragraph -> list -> paragraph', async () => {
        const muya = bootMuya('hello world\n');
        const content = placeCursorOnFirstBlock(muya);
        content.setCursor(2, 6, true); // select offsets [2, 6)

        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('bullet-list'));
        expect(muya.editor.selection.anchor?.offset).toBe(2);
        expect(muya.editor.selection.focus?.offset).toBe(6);

        muya.updateParagraph('ul-bullet'); // toggle back to paragraph
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('paragraph'));
        expect(muya.editor.selection.anchor?.offset).toBe(2);
        expect(muya.editor.selection.focus?.offset).toBe(6);
    });

    it('inserts a thematic break + trailing empty paragraph below a non-empty paragraph', async () => {
        const muya = bootMuya('hello\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('hr');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(3);
            expect(s[0].name).toBe('paragraph');
            expect((s[0] as { text: string }).text).toBe('hello');
            expect(s[1].name).toBe('thematic-break');
            expect(s[2].name).toBe('paragraph');
        });
    });

    it('unwraps an enclosing block-quote (with a heading inside) instead of nesting one', async () => {
        const muya = bootMuya('> # Title\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('blockquote');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('atx-heading');
        });
    });
});

describe('updateParagraph toggle-off active types', () => {
    it('unwraps the matching list kind, leaving other kinds (ul > task > ol, click ordered)', async () => {
        const muya = bootMuya('- a\n    - [ ] b\n        1. c\n');
        placeCursorOnLastContent(muya); // cursor in the ordered list item
        muya.updateParagraph('ol-order');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(hasName(s, 'order-list')).toBe(false);
            expect(hasName(s, 'bullet-list')).toBe(true);
            expect(hasName(s, 'task-list')).toBe(true);
        });
    });

    it('removes every nested level of the clicked kind (ul > ul, click unordered)', async () => {
        const muya = bootMuya('- a\n\n  - b\n');
        placeCursorOnLastContent(muya); // cursor in the inner bullet list
        muya.updateParagraph('ul-bullet');
        await vi.waitFor(() => {
            expect(hasName(muya.getState(), 'bullet-list')).toBe(false);
        });
    });

    it('converts the cursor list to a different kind when that kind is not active', async () => {
        const muya = bootMuya('- a\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('ol-order');
        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('order-list');
        });
    });

    it('toggles a heading back to a paragraph when its current level is clicked', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('heading 1');
        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('paragraph');
        });
    });

    it('changes the heading level when a different level is clicked', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('heading 2');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('atx-heading');
            expect((s[0] as { meta: { level: number } }).meta.level).toBe(2);
        });
    });

    it('toggles a thematic break back to a paragraph when clicked from within', async () => {
        const muya = bootMuya('---\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('hr');
        await vi.waitFor(() => {
            expect(muya.getState()[0].name).toBe('paragraph');
        });
    });
});
