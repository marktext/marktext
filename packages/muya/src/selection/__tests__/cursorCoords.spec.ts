// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCursorCoords } from '../cursorCoords';

afterEach(() => {
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
    document.body.replaceChildren();
});

function selectText(start: number, end: number) {
    const paragraph = document.createElement('p');
    paragraph.textContent = 'wrapped text';
    document.body.appendChild(paragraph);
    const range = document.createRange();
    range.setStart(paragraph.firstChild!, start);
    range.setEnd(paragraph.firstChild!, end);
    document.getSelection()!.addRange(range);
}

function mockRects(rects: DOMRect[]) {
    vi.spyOn(Range.prototype, 'getClientRects').mockReturnValue(
        Object.assign(rects, { item: (index: number) => rects[index] ?? null }),
    );
}

describe('caret coordinates at a soft wrap (#3510)', () => {
    it('uses the new line for a collapsed range with two caret rects', () => {
        selectText(8, 8);
        const previousLine = new DOMRect(400, 100, 0, 20);
        const nextLine = new DOMRect(0, 120, 0, 20);
        mockRects([previousLine, nextLine]);
        expect(getCursorCoords()).toBe(nextLine);
        expect(getCursorCoords(true)).toBe(nextLine);
    });

    it('keeps the requested endpoint for a non-collapsed selection', () => {
        selectText(0, 12);
        const start = new DOMRect(0, 100, 100, 20);
        const end = new DOMRect(0, 120, 100, 20);
        mockRects([start, end]);
        expect(getCursorCoords()).toBe(start);
        expect(getCursorCoords(true)).toBe(end);
    });

    it('keeps a single caret rect unchanged', () => {
        selectText(4, 4);
        const caret = new DOMRect(40, 100, 0, 20);
        mockRects([caret]);
        expect(getCursorCoords()).toBe(caret);
    });

    it('returns null when no selection exists', () => {
        expect(getCursorCoords()).toBeNull();
    });
});
