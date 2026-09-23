// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { lineAtPoint, resolveEndpoint } from '../dom';

const editors: Muya[] = [];
const hosts: HTMLElement[] = [];
let originalVersion: string | undefined;

beforeEach(() => {
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (editors.length)
        editors.pop()!.destroy();
    while (hosts.length)
        hosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    delete (document as Partial<Document>).caretPositionFromPoint;
    if (originalVersion === undefined)
        delete (window as Partial<Window>).MUYA_VERSION;
    else
        window.MUYA_VERSION = originalVersion;
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
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
    document.caretPositionFromPoint = () => ({ offsetNode: node, offset }) as unknown as CaretPosition;
}

describe('resolveEndpoint', () => {
    it('maps a text node inside a paragraph to its block and character offset', () => {
        const muya = boot('alpha beta\n');
        const block = content(muya, 'alpha beta');

        expect(resolveEndpoint(textNodeIn(block.domNode!), 4)).toEqual({ offset: 4, block, path: block.path });
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

describe('lineAtPoint', () => {
    it('covers the whole line the caret landed on', () => {
        const muya = boot('alpha beta\n\nnext words\n');
        const block = content(muya, 'alpha beta');
        caretLandsOn(textNodeIn(block.domNode!), 4);

        expect(lineAtPoint(document, 0, 0)).toEqual({ block, start: 0, end: 10 });
    });

    // `line one\nline two\nline three` — one block, three lines.
    it.each([
        { name: 'first', caret: 3, start: 0, end: 8 },
        { name: 'middle', caret: 12, start: 9, end: 17 },
        { name: 'last', caret: 20, start: 18, end: 28 },
    ])('covers only the $name line of a code block', ({ caret, start, end }) => {
        const muya = boot('```js\nline one\nline two\nline three\n```\n');
        const block = content(muya, 'line one\nline two\nline three');
        caretLandsOn(block.domNode!, caret);

        expect(lineAtPoint(document, 0, 0)).toEqual({ block, start, end });
    });

    it('returns null when the document cannot place a caret at the point', () => {
        boot('alpha beta\n');
        document.caretPositionFromPoint = () => null;

        expect(lineAtPoint(document, 0, 0)).toBeNull();
    });
});
