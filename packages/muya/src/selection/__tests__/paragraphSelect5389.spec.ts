// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { resolveEndpoint } from '../dom';
import { paragraphSelectLine } from '../paragraphSelect';

const editors: Muya[] = [];
let originalVersion: string | undefined;
let originalCaretFromPoint: Document['caretPositionFromPoint'] | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
    originalCaretFromPoint = document.caretPositionFromPoint;
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    document.getSelection()?.removeAllRanges();
    if (originalCaretFromPoint === undefined)
        delete (document as Partial<Document>).caretPositionFromPoint;
    else
        document.caretPositionFromPoint = originalCaretFromPoint;
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown });
    muya.init();
    editors.push(muya);
    return muya;
}

function content(muya: Muya, text: string): Content {
    let result: Content | undefined;
    muya.editor.scrollPage!.breadthFirstTraverse((block) => {
        if (block.isContent() && block.text === text)
            result = block;
    });
    if (!result)
        throw new Error(`Content not found: ${text}`);
    return result;
}

function textNodeIn(node: Node): Node {
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const first = walker.nextNode();
    if (!first)
        throw new Error('no text node');
    return first;
}

/**
 * happy-dom has no layout, so the caret a real pointer would land on is handed
 * in directly. Only the position comes from the stub; resolving it to a block
 * and bounding its line is the code under test.
 */
function caretLandsOn(node: Node, offset: number): void {
    document.caretPositionFromPoint = () => ({
        offsetNode: node,
        offset,
        getClientRect: () => null,
    }) as unknown as CaretPosition;
}

describe('resolveEndpoint', () => {
    it('maps a text node inside a paragraph to its block and character offset', () => {
        const muya = boot('alpha beta\n');
        const block = content(muya, 'alpha beta');

        expect(resolveEndpoint(textNodeIn(block.domNode!), 4)).toEqual({ block, offset: 4 });
    });

    it.each([
        { name: 'a table, which owns no editable leaf', markdown: 'alpha\n\n| h1 | h2 |\n| -- | -- |\n| c1 | c2 |\n', selector: 'figure.mu-table' },
        { name: 'a task-list item, whose first child is the checkbox', markdown: 'alpha\n\n- [ ] task\n', selector: 'li.mu-task-list-item' },
    ])('returns null for $name', ({ markdown, selector }) => {
        const muya = boot(markdown);

        expect(resolveEndpoint(muya.domNode.querySelector(selector)!, 0)).toBeNull();
    });

    it('returns null for a node the document no longer holds', () => {
        const muya = boot('alpha beta\n');
        const block = content(muya, 'alpha beta');

        expect(resolveEndpoint(block.domNode!.cloneNode(true), 0)).toBeNull();
    });
});

describe('paragraphSelectLine', () => {
    it('covers the whole line the caret landed on', () => {
        const muya = boot('alpha beta\n\nnext words\n');
        const block = content(muya, 'alpha beta');
        caretLandsOn(textNodeIn(block.domNode!), 4);

        expect(paragraphSelectLine(document, 0, 0)).toEqual({
            anchor: { block, offset: 0, path: block.path },
            focus: { block, offset: 10, path: block.path },
        });
    });

    // `line one\nline two\nline three` — one block, three lines.
    it.each([
        { name: 'first', caret: 3, expected: { anchor: 0, focus: 8 } },
        { name: 'middle', caret: 12, expected: { anchor: 9, focus: 17 } },
        { name: 'last', caret: 20, expected: { anchor: 18, focus: 28 } },
    ])('covers only the $name line of a code block', ({ caret, expected }) => {
        const muya = boot('```js\nline one\nline two\nline three\n```\n');
        const block = content(muya, 'line one\nline two\nline three');
        caretLandsOn(block.domNode!, caret);

        const range = paragraphSelectLine(document, 0, 0);

        expect(range?.anchor.block).toBe(block);
        expect({ anchor: range?.anchor.offset, focus: range?.focus.offset }).toEqual(expected);
    });

    it('returns null when the caret landed outside any content block', () => {
        const muya = boot('alpha\n\n| h1 | h2 |\n| -- | -- |\n| c1 | c2 |\n');
        caretLandsOn(muya.domNode.querySelector('figure.mu-table')!, 0);

        expect(paragraphSelectLine(document, 0, 0)).toBeNull();
    });

    it('returns null when the document cannot place a caret at the point', () => {
        boot('alpha beta\n');
        document.caretPositionFromPoint = () => null;

        expect(paragraphSelectLine(document, 0, 0)).toBeNull();
    });
});
