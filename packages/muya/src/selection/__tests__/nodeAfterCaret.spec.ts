// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { isInlinePreview, nodeAfterCaret } from '../dom';

// The live render of `$x = 3$` while the caret is inside it.
function renderInlineMath() {
    const root = document.createElement('span');
    root.innerHTML = '<span class="mu-math-marker">$</span>'
        + '<span class="mu-math"><span class="mu-math-text">x = 3</span>'
        + '<span class="mu-math-render" contenteditable="false">x=3</span></span>'
        + '<span class="mu-math-marker">$</span> after';
    const [opening, math, closing] = root.children;
    const source = math.firstElementChild!.firstChild!;
    const preview = math.lastElementChild!;

    return { root, opening, source, preview, closing };
}

describe('nodeAfterCaret', () => {
    it('returns the text node itself while characters follow the caret', () => {
        const { root, source } = renderInlineMath();

        expect(nodeAfterCaret(source, 4, root)).toBe(source);
    });

    it('climbs out of an exhausted text node to the preview after it', () => {
        const { root, source, preview } = renderInlineMath();

        expect(nodeAfterCaret(source, 5, root)).toBe(preview);
        expect(isInlinePreview(preview)).toBe(true);
    });

    it('reads an element anchor as a child index', () => {
        const { root, preview } = renderInlineMath();

        expect(nodeAfterCaret(preview.parentNode!, 1, root)).toBe(preview);
    });

    it('skips empty text nodes', () => {
        const { root, source, preview } = renderInlineMath();
        source.parentNode!.appendChild(document.createTextNode(''));

        expect(nodeAfterCaret(source, 5, root)).toBe(preview);
    });

    it('does not report a preview after the closing marker', () => {
        const { root, closing } = renderInlineMath();
        const next = nodeAfterCaret(closing.firstChild!, 1, root);

        expect(next?.textContent).toBe(' after');
        expect(isInlinePreview(next)).toBe(false);
    });

    it('returns null at the end of the root', () => {
        const { root } = renderInlineMath();

        expect(nodeAfterCaret(root.lastChild!, ' after'.length, root)).toBeNull();
    });
});
