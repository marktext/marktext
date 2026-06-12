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

            if (rects?.length)
                rect = preferEnd ? rects[rects.length - 1] : rects[0];
        }
    }

    return rect;
}

export function getSelectionStart(): Node | null {
    const node = document.getSelection()!.anchorNode;

    return node && node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
}

export function getCursorYOffset(paragraph: HTMLElement): { topOffset: number; bottomOffset: number } {
    const { y } = getCursorCoords()!;
    const { height, top } = paragraph.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(paragraph).lineHeight);
    const topOffset = Math.floor((y - top) / lineHeight);
    const bottomOffset = Math.round((top + height - lineHeight - y) / lineHeight);

    return { topOffset, bottomOffset };
}
