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

    it('inserts a thematic break + trailing empty paragraph below a non-empty heading (heading kept)', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('hr');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s.length).toBe(3);
            expect(s[0].name).toBe('atx-heading');
            expect((s[0] as { text: string }).text).toBe('# Title'); // heading kept
            expect(s[1].name).toBe('thematic-break'); // rule below it
            expect(s[2].name).toBe('paragraph');
            expect((s[2] as { text: string }).text).toBe(''); // trailing empty paragraph
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

    it('toggles a thematic break to an EMPTY paragraph (drops the --- markers) and focuses it', async () => {
        const muya = bootMuya('---\n');
        placeCursorOnFirstBlock(muya);
        muya.updateParagraph('hr');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[0].name).toBe('paragraph');
            expect((s[0] as { text: string }).text).toBe('');
        });
        expect(muya.editor.selection.anchorBlock?.text).toBe('');
    });

    it('toggling one of several thematic breaks lands the caret in ITS empty paragraph, not another rule', async () => {
        const muya = bootMuya('a\n\n---\n\nb\n\n---\n\nc\n'); // two hrs at index 1 and 3
        // eslint-disable-next-line ts/no-explicit-any
        const secondHr = (muya.editor.scrollPage!.firstChild as any).next.next.next;
        const hrContent = secondHr.firstContentInDescendant();
        muya.editor.activeContentBlock = hrContent;
        hrContent.setCursor(0, 0, true);
        muya.updateParagraph('hr');
        await vi.waitFor(() => {
            const s = muya.getState();
            expect(s[1].name).toBe('thematic-break'); // first rule survives
            expect(s[3].name).toBe('paragraph'); // toggled one
            expect((s[3] as { text: string }).text).toBe('');
        });
        // caret is in the new empty paragraph, not the surviving rule's "---"
        expect(muya.editor.selection.anchorBlock?.text).toBe('');
    });

    it('keeps the caret in the same text when toggling a nested list off', async () => {
        const muya = bootMuya('- a\n\n  - bravo\n');
        const content = placeCursorOnLastContent(muya); // cursor in "bravo"
        content.setCursor(3, 3, true);
        muya.updateParagraph('ul-bullet'); // toggle every bullet list off
        await vi.waitFor(() => expect(hasName(muya.getState(), 'bullet-list')).toBe(false));
        expect(muya.editor.selection.anchorBlock?.text).toBe('bravo');
        expect(muya.editor.selection.anchor?.offset).toBe(3);
    });

    it('keeps the caret position (accounting for "# ") when toggling a heading to a paragraph', async () => {
        const muya = bootMuya('# Title\n');
        const content = placeCursorOnFirstBlock(muya); // content text is "# Title"
        content.setCursor(5, 5, true); // after "# Tit"
        muya.updateParagraph('heading 1'); // toggle heading off -> "Title"
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('paragraph'));
        expect(muya.editor.selection.anchorBlock?.text).toBe('Title');
        expect(muya.editor.selection.anchor?.offset).toBe(3); // 5 - len("# ")
    });

    it('keeps the caret position (accounting for "# ") when converting a paragraph to a heading', async () => {
        const muya = bootMuya('Title\n');
        const content = placeCursorOnFirstBlock(muya);
        content.setCursor(3, 3, true); // after "Tit"
        muya.updateParagraph('heading 1'); // -> "# Title"
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('atx-heading'));
        expect(muya.editor.selection.anchorBlock?.text).toBe('# Title');
        expect(muya.editor.selection.anchor?.offset).toBe(5); // 3 + len("# ")
    });

    it('keeps the caret when degrading a heading level (## -> ###)', async () => {
        const muya = bootMuya('## Title\n');
        const content = placeCursorOnFirstBlock(muya);
        content.setCursor(6, 6, true); // after "## Tit"
        muya.updateParagraph('degrade heading'); // h2 -> h3
        await vi.waitFor(() => {
            const s = muya.getState();
            expect((s[0] as { meta: { level: number } }).meta.level).toBe(3);
        });
        expect(muya.editor.selection.anchor?.offset).toBe(7); // +1 for the extra '#'
    });

    it('keeps the caret when upgrading a heading level (## -> #)', async () => {
        const muya = bootMuya('## Title\n');
        const content = placeCursorOnFirstBlock(muya);
        content.setCursor(6, 6, true); // after "## Tit"
        muya.updateParagraph('upgrade heading'); // h2 -> h1
        await vi.waitFor(() => {
            const s = muya.getState();
            expect((s[0] as { meta: { level: number } }).meta.level).toBe(1);
        });
        expect(muya.editor.selection.anchor?.offset).toBe(5); // -1 for the removed '#'
    });

    it('clears the markers when the Paragraph menu item resets a thematic break', async () => {
        const muya = bootMuya('---\n');
        placeCursorOnFirstBlock(muya); // content text is the "---" marker
        muya.updateParagraph('paragraph'); // reset the hr leaf
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('paragraph'));
        expect((muya.getState()[0] as { text: string }).text).toBe(''); // empty, no "---"
        expect(muya.editor.selection.anchorBlock?.text).toBe('');
    });

    it('keeps the caret when the Paragraph menu item resets a heading leaf', async () => {
        const muya = bootMuya('## Title\n');
        const content = placeCursorOnFirstBlock(muya); // content text is "## Title"
        content.setCursor(6, 6, true); // after "## Tit"
        muya.updateParagraph('paragraph'); // reset the heading leaf -> "Title"
        await vi.waitFor(() => expect(muya.getState()[0].name).toBe('paragraph'));
        expect(muya.editor.selection.anchorBlock?.text).toBe('Title');
        expect(muya.editor.selection.anchor?.offset).toBe(3); // 6 - len("## ")
    });
});
