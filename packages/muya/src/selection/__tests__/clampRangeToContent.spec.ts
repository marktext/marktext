// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { clampRangeToContent } from '../dom';

// #5035: Chromium ends a triple-click selection at offset 0 of the next block
// when that block starts with a checkbox or is a table, where no content leaf
// holds it. The range ends are pulled back onto the leaves the range covers.

let root: HTMLElement;

afterEach(() => {
    root?.remove();
});

function mount(html: string): HTMLElement {
    root = document.createElement('div');
    root.innerHTML = html;
    document.body.appendChild(root);
    return root;
}

function leafText(selector: string): Text {
    return root.querySelector(selector)!.firstChild!.firstChild as Text;
}

const DOC = [
    '<p><span class="mu-content" id="text"><span class="mu-plain-text">text</span></span></p>',
    '<ul><li id="task"><input type="checkbox">',
    '<p><span class="mu-content" id="task-text"><span class="mu-plain-text">task</span></span></p>',
    '</li></ul>',
].join('');

describe('clampRangeToContent (#5035)', () => {
    it('pulls an end at the start of the next block back to the end of the last leaf it covers', () => {
        mount(DOC);
        const range = document.createRange();
        range.setStart(leafText('#text'), 0);
        range.setEnd(root.querySelector('#task')!, 0);

        expect(clampRangeToContent(range, root)).toBe(true);

        expect(range.startContainer).toBe(leafText('#text'));
        expect(range.startOffset).toBe(0);
        expect(range.endContainer).toBe(leafText('#text'));
        expect(range.endOffset).toBe(4);
    });

    it('pulls a start outside every leaf forward to the start of the first leaf it covers', () => {
        mount(DOC);
        const range = document.createRange();
        range.setStart(root.querySelector('#task')!, 0);
        range.setEnd(leafText('#task-text'), 2);

        expect(clampRangeToContent(range, root)).toBe(true);

        expect(range.startContainer).toBe(leafText('#task-text'));
        expect(range.startOffset).toBe(0);
        expect(range.endContainer).toBe(leafText('#task-text'));
        expect(range.endOffset).toBe(2);
    });

    it('leaves a range that covers no leaf untouched', () => {
        mount(DOC);
        const task = root.querySelector('#task')!;
        const range = document.createRange();
        range.setStart(task, 0);
        range.setEnd(task, 1);

        expect(clampRangeToContent(range, root)).toBe(false);

        expect(range.startContainer).toBe(task);
        expect(range.endContainer).toBe(task);
        expect(range.endOffset).toBe(1);
    });
});
