import { isElement } from '../utils';

export function getCursorCoords(preferEnd = false): DOMRect | null {
    const sel = document.getSelection();
    let range;
    let rect: DOMRect | null = null;

    if (sel?.rangeCount) {
        range = sel.getRangeAt(0).cloneRange();
        if (range.getClientRects) {
            let rects: DOMRectList | null = range.getClientRects();
            if (rects.length === 0) {
                rects
                    = range.startContainer && isElement(range.startContainer)
                        ? range.startContainer.getClientRects()
                        : null;
            }

            // Chromium exposes both sides of a soft wrap for a collapsed
            // range. The last rect is the new line's start (#3510).
            if (rects?.length)
                rect = range.collapsed || preferEnd ? rects[rects.length - 1] : rects[0];
        }
    }

    return rect;
}

export function getSelectionStart(): Node | null {
    const node = document.getSelection()!.anchorNode;

    return node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
}

export function getCursorYOffset(paragraph: HTMLElement): { topOffset: number; bottomOffset: number } {
    const coords = getCursorCoords();
    // A missing client rect means an unknown caret position; let navigation leave the block.
    if (coords == null)
        return { topOffset: 0, bottomOffset: 0 };

    const { y } = coords;
    const { height, top } = paragraph.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight);
    const topOffset = Math.floor((y - top) / lineHeight);
    const bottomOffset = Math.round((top + height - lineHeight - y) / lineHeight);

    return { topOffset, bottomOffset };
}
