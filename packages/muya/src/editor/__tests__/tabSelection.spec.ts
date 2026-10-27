// @vitest-environment happy-dom
import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';
import { createTextSelectionState } from '../../selection/state';
import { MarkdownToState } from '../../state/markdownToState';
import { isAnyListState } from '../../state/types';

const editors: Muya[] = [];

function boot(markdown: string, tabSize: number | 'tab' = 2) {
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
    it.each([4, 'tab'] as const)('converts a backward multiline paragraph selection to indented code with %s input', (tabSize) => {
        const markdown = 'one\n**two**\n';
        const muya = boot(markdown, tabSize);
        const block = content(muya, 'one\n**two**');
        select(muya, block, block.text.length, block, 0);
        tab(block);
        expect(muya.getState()).toEqual([{
            name: 'code-block',
            meta: { type: 'indented', lang: '' },
            text: 'one\n**two**',
        }]);
        const selection = muya.editor.selection.getTextSelection()!;
        expect(selection.anchor.block.text).toBe('one\n**two**');
        expect(selection.anchor.offset).toBe(11);
        expect(selection.focus.offset).toBe(0);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
        muya.undo();
        expect(muya.getMarkdown()).toBe(markdown);
        expect(muya.editor.selection.getTextSelection()!.anchor.offset).toBe(11);
        muya.redo();
        expect(muya.getState()[0].name).toBe('code-block');
    });

    it('waits for four columns with two-space input', () => {
        const muya = boot('one\ntwo\n');
        const block = content(muya, 'one\ntwo');
        select(muya, block, 0, block, block.text.length);
        tab(block);
        expect(muya.getState()).toEqual([{ name: 'paragraph', text: '  one\n  two' }]);
        tab(block);
        expect(muya.getState()).toEqual([{
            name: 'code-block',
            meta: { type: 'indented', lang: '' },
            text: 'one\ntwo',
        }]);
        muya.undo();
        expect(muya.getState()).toEqual([{ name: 'paragraph', text: '  one\n  two' }]);
    });

    it('joins indented paragraphs and preserves their blank line and code payload tabs', () => {
        const muya = boot('before\n\none\t1\n\ntwo\t2\n\nafter\n', 'tab');
        const one = content(muya, 'one\t1');
        const two = content(muya, 'two\t2');
        select(muya, one, 0, two, two.text.length);
        tab(one);
        expect(muya.getState()).toEqual([
            { name: 'paragraph', text: 'before' },
            { name: 'code-block', meta: { type: 'indented', lang: '' }, text: 'one\t1\n\ntwo\t2' },
            { name: 'paragraph', text: 'after' },
        ]);
        expect(muya.editor.selection.getTextSelection()!.focus.offset).toBe(12);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it('keeps indented continuation lines in their existing paragraph', () => {
        const muya = boot('one\ntwo\nthree\n', 4);
        const block = content(muya, 'one\ntwo\nthree');
        select(muya, block, 4, block, block.text.length);
        tab(block);
        expect(muya.getState()).toEqual([{ name: 'paragraph', text: 'one\n    two\n    three' }]);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it('splits a code prefix from an unindented tail and maps the excluded endpoint', () => {
        const muya = boot('one\ntwo\nthree\n', 4);
        const block = content(muya, 'one\ntwo\nthree');
        select(muya, block, 0, block, 8);
        tab(block);
        expect(muya.getState()).toEqual([
            { name: 'code-block', meta: { type: 'indented', lang: '' }, text: 'one\ntwo' },
            { name: 'paragraph', text: 'three' },
        ]);
        const selection = muya.editor.selection.getTextSelection()!;
        expect(selection.anchor.block.text).toBe('one\ntwo');
        expect(selection.anchor.offset).toBe(0);
        expect(selection.focus.block.text).toBe('three');
        expect(selection.focus.offset).toBe(0);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it('preserves an excluded final paragraph and its endpoint', () => {
        const muya = boot('one\n\ntwo\n\nthree\n', 4);
        const one = content(muya, 'one');
        const three = content(muya, 'three');
        select(muya, one, 0, three, 0);
        tab(one);
        expect(muya.getState()).toEqual([
            { name: 'code-block', meta: { type: 'indented', lang: '' }, text: 'one\n\ntwo' },
            { name: 'paragraph', text: 'three' },
        ]);
        expect(muya.editor.selection.getTextSelection()!.focus.block.text).toBe('three');
        expect(muya.editor.selection.getTextSelection()!.focus.offset).toBe(0);
    });

    it('recognizes a non-interrupting ordered marker exposed after a code prefix', () => {
        const muya = boot('one\n2. two\nthree\n', 4);
        const block = content(muya, 'one\n2. two\nthree');
        select(muya, block, 0, block, 4);
        tab(block);
        expect(muya.getState().map(state => state.name)).toEqual(['code-block', 'order-list']);
        const selection = muya.editor.selection.getTextSelection()!;
        expect(selection.focus.block.text).toBe('two\nthree');
        expect(selection.focus.offset).toBe(0);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
        muya.undo();
        expect(muya.getState()).toEqual([{ name: 'paragraph', text: 'one\n2. two\nthree' }]);
    });

    it('keeps an endpoint at the end of a paragraph before the converted code', () => {
        const muya = boot('one\ntwo\n\nthree\n', 4);
        const first = content(muya, 'one\ntwo');
        const last = content(muya, 'three');
        select(muya, first, first.text.length, last, last.text.length);
        tab(first);
        expect(muya.getState().map(state => state.name)).toEqual(['paragraph', 'code-block']);
        const selection = muya.editor.selection.getTextSelection()!;
        expect(selection.anchor.block.text).toBe('one\n    two');
        expect(selection.anchor.offset).toBe(11);
        expect(selection.focus.block.text).toBe('three');
        expect(selection.focus.offset).toBe(5);
    });

    it('preserves existing leading spaces and payload tabs beyond the structural four columns', () => {
        const muya = boot('  one\t1\n two\t2\n', 'tab');
        const block = content(muya, '  one\t1\n two\t2');
        select(muya, block, 0, block, block.text.length);
        tab(block);
        expect(muya.getState()).toEqual([{
            name: 'code-block',
            meta: { type: 'indented', lang: '' },
            text: '  one\t1\n two\t2',
        }]);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it('converts inside a quote without moving the paragraphs outside the container', () => {
        const muya = boot('> one\n>\n> two\n', 4);
        const one = content(muya, 'one');
        const two = content(muya, 'two');
        select(muya, one, 0, two, 3);
        tab(one);
        expect(muya.getState()).toEqual([{
            name: 'block-quote',
            children: [{
                name: 'code-block',
                meta: { type: 'indented', lang: '' },
                text: 'one\n\ntwo',
            }],
        }]);
        expect(new MarkdownToState(muya.options).generate(muya.getMarkdown())).toEqual(muya.getState());
    });

    it.each([false, true])('inherits adjacent sublist looseness for a selected item: %s', (selected) => {
        const muya = boot('- a\n  - [ ] b\n\n- c\n');
        const block = content(muya, 'c');
        select(muya, block, selected ? 0 : 1, block, 1);
        tab(block);
        const outer = muya.getState()[0];
        if (!isAnyListState(outer))
            throw new Error('Expected a list');
        const sublists = outer.children[0].children.filter(isAnyListState);
        expect(sublists.map(list => list.meta.loose)).toEqual([false, false]);
    });

    it.each([false, true])('appends the remaining tail to an existing sublist for a selected item: %s', (selected) => {
        const markdown = '- a\n  - b\n    - c\n  - d\n';
        const muya = boot(markdown);
        const block = content(muya, 'b');
        select(muya, block, selected ? 0 : 1, block, 1);
        tab(block, true);
        expect(muya.getMarkdown()).toBe('- a\n- b\n  - c\n  - d\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe(markdown);
    });

    it('keeps caret outdent to a paragraph when the nested list begins the item', () => {
        const muya = boot('- - b\n');
        const block = content(muya, 'b');
        select(muya, block, 1);
        tab(block, true);
        expect(muya.getMarkdown()).toBe('- b\n');
    });

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

    it('outdents Python past the previous line indentation (#2371)', () => {
        const muya = boot('```python\ndef foo(x):\n    if x > 1:\n        return x\n```\n', 4);
        const block = content(muya, 'def foo(x):\n    if x > 1:\n        return x');
        select(muya, block, block.text.length);
        tab(block, true);
        expect(block.text).toBe('def foo(x):\n    if x > 1:\n    return x');
        tab(block, true);
        expect(block.text).toBe('def foo(x):\n    if x > 1:\nreturn x');
    });

    it.each([2, 4, 'tab'] as const)('uses %s input for multiline code indent and outdent (#2371, #3205)', (tabSize) => {
        const muya = boot('```text\none\ntwo\n```\n', tabSize);
        const block = content(muya, 'one\ntwo');
        select(muya, block, 0, block, block.text.length);
        tab(block);
        const unit = tabSize === 'tab' ? '\t' : ' '.repeat(tabSize);
        expect(block.text).toBe(`${unit}one\n${unit}two`);
        tab(block, true);
        expect(block.text).toBe('one\ntwo');
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
