// @vitest-environment happy-dom
import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { createTextSelectionState } from '../../selection/state';

const editors: Muya[] = [];

function boot(markdown: string, tabSize = 2) {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, tabSize });
    muya.init();
    editors.push(muya);
    return muya;
}

function content(muya: Muya, text: string): Content {
    let found: Content | undefined;
    const visit = (parent: Parent) => parent.forEach((child) => {
        if (child.isContent() && child.text === text)
            found = child;
        else if (child.isParent())
            visit(child);
    });
    visit(muya.editor.scrollPage!);
    if (!found)
        throw new Error(`Missing content ${JSON.stringify(text)}`);
    return found;
}

function select(muya: Muya, a: Content, anchor: number, b = a, focus = anchor) {
    muya.setSelection(createTextSelectionState(
        { block: a, path: a.path, offset: anchor },
        { block: b, path: b.path, offset: focus },
    ));
}

function tab(block: Content, shiftKey = false) {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    block.domNode!.dispatchEvent(event);
    return event;
}

afterEach(() => {
    vi.restoreAllMocks();
    for (const editor of editors.splice(0)) {
        editor.destroy();
        editor.domNode.remove();
    }
    document.getSelection()?.removeAllRanges();
});
describe('selection indentation', () => {
    it('replaces a backward single-line selection with the input indentation', () => {
        const muya = boot('hello world\n');
        const block = content(muya, 'hello world');
        select(muya, block, 11, block, 6);
        tab(block);
        expect(block.text).toBe('hello   ');
        expect(block.getCursor()!.start.offset).toBe(8);
    });

    it('collapses selected indentation even when replacement leaves the text unchanged', () => {
        const muya = boot('a  b\n');
        const block = content(muya, 'a  b');
        select(muya, block, 1, block, 3);
        tab(block);
        expect(block.text).toBe('a  b');
        expect(block.getCursor()!.isCollapsed).toBe(true);
        expect(block.getCursor()!.start.offset).toBe(3);
    });

    it('indents selected code lines and preserves backward selection', () => {
        const muya = boot('```text\none\ntwo\nthree\n```\n');
        const block = content(muya, 'one\ntwo\nthree');
        select(muya, block, 8, block, 0);
        tab(block);
        expect(block.text).toBe('  one\n  two\nthree');
        expect(block.getCursor()!.anchor.offset).toBe(12);
        expect(block.getCursor()!.focus.offset).toBe(2);
        tab(block, true);
        expect(block.text).toBe('one\ntwo\nthree');
    });

    it('does not expand a code abbreviation on Shift Tab', () => {
        const muya = boot('```html\n\tdiv\n```\n');
        const block = content(muya, '\tdiv');
        select(muya, block, 4);
        tab(block, true);
        expect(block.text).toBe('div');
    });

    it.each([
        { text: '\tone\n\ttwo', offset: 4, expected: 'one\n\ttwo' },
        { text: '\n\ttwo', offset: 0, expected: '\n\ttwo' },
    ])('outdents only the caret line at offset $offset in $text', ({ text, offset, expected }) => {
        const muya = boot(`\`\`\`text\n${text}\n\`\`\`\n`);
        const block = content(muya, text);
        select(muya, block, offset);
        tab(block, true);
        expect(block.text).toBe(expected);
    });

    it('indents and outdents contiguous list items as a group', () => {
        const muya = boot('- a\n- b\n- c\n- d\n');
        select(muya, content(muya, 'b'), 0, content(muya, 'c'), 1);
        tab(content(muya, 'b'));
        expect(muya.getMarkdown()).toBe('- a\n  - b\n  - c\n- d\n');
        content(muya, 'b').domNode!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', bubbles: true }));
        expect(muya.getMarkdown()).toBe('- a\n  - b\n  - c\n- d\n');
        tab(content(muya, 'b'), true);
        expect(muya.getMarkdown()).toBe('- a\n- b\n- c\n- d\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe('- a\n  - b\n  - c\n- d\n');
    });

    it('keeps a selection within one list item structural', () => {
        const muya = boot('- a\n- bravo\n');
        select(muya, content(muya, 'bravo'), 1, content(muya, 'bravo'), 4);
        tab(content(muya, 'bravo'));
        expect(muya.getMarkdown()).toBe('- a\n  - bravo\n');
        tab(content(muya, 'bravo'), true);
        expect(muya.getMarkdown()).toBe('- a\n- bravo\n');
    });

    it('lifts selected task items out of a plain list without losing later outer items', () => {
        const muya = boot('- a\n  - [ ] b\n  - [x] c\n- d\n');
        select(muya, content(muya, 'b'), 0, content(muya, 'c'), 1);
        tab(content(muya, 'b'), true);
        expect(muya.getMarkdown()).toBe('- a\n- [ ] b\n- [x] c\n- d\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe('- a\n  - [ ] b\n  - [x] c\n- d\n');
    });

    it('retains the start number of the remaining ordered tail when outdenting', () => {
        const markdown = '- a\n  5. b\n  6. c\n  7. d\n';
        const muya = boot(markdown);
        select(muya, content(muya, 'b'), 0, content(muya, 'd'), 0);
        tab(content(muya, 'b'), true);
        expect(muya.getMarkdown()).toBe('- a\n- b\n- c\n  7. d\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe(markdown);
        muya.redo();
        expect(muya.getMarkdown()).toBe('- a\n- b\n- c\n  7. d\n');
    });

    it('starts a lifted ordered task run at the selected item number', () => {
        const markdown = '- a\n  5. [ ] b\n  6. [x] c\n  7. [ ] d\n';
        const muya = boot(markdown);
        select(muya, content(muya, 'c'), 0, content(muya, 'd'), 0);
        tab(content(muya, 'c'), true);
        expect(muya.getMarkdown()).toBe('- a\n  5. [ ] b\n6. [x] c\n   7. [ ] d\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe(markdown);
    });

    it('suppresses Tab for mixed blocks without deleting the selection', () => {
        const muya = boot('hello\n\n# title\n');
        select(muya, content(muya, 'hello'), 0, content(muya, '# title'), 7);
        expect(tab(content(muya, 'hello')).defaultPrevented).toBe(true);
        expect(muya.getMarkdown()).toBe('hello\n\n# title\n');
    });

    it.each([false, true])('outdents a selection ending at the start of an excluded tail item (backward: %j)', (backward) => {
        const markdown = '- a\n  - b\n  - c\n  - d\n';
        const muya = boot(markdown);
        const b = content(muya, 'b');
        const d = content(muya, 'd');
        select(muya, backward ? d : b, 0, backward ? b : d, 0);
        tab(b, true);
        expect(muya.getMarkdown()).toBe('- a\n- b\n- c\n  - d\n');
        const selection = muya.editor.selection.getTextSelection()!;
        expect(selection.anchor.block.text).toBe(backward ? 'd' : 'b');
        expect(selection.focus.block.text).toBe(backward ? 'b' : 'd');
        expect(selection.anchor.offset).toBe(0);
        expect(selection.focus.offset).toBe(0);
        muya.undo();
        expect(muya.getMarkdown()).toBe(markdown);
        muya.redo();
        expect(muya.getMarkdown()).toBe('- a\n- b\n- c\n  - d\n');
    });
});
