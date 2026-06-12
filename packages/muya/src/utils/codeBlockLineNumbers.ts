// Visible line count for a code block, matching marktext `a028a7c2`:
//   - each `\n` adds a row
//   - a trailing `\n` still counts as the next visible (empty) row in
//     contenteditable, which falls out naturally from "count + 1"
//
// Implemented with a charCode loop (no regex match array allocation —
// this is called on every code-block update, including large pasted blobs).
const LF = 10;

export function computeLineCount(text: string): number {
    let count = 1;
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === LF)
            count++;
    }
    return count;
}

export const LINE_NUMBERS_ROWS_CLASS = 'mu-line-numbers-rows';

// The wrapper starts empty; CodeBlockContent.update() syncs spans on demand
// via `syncLineNumbersSpans` (delta updates, no full innerHTML rewrite).
export function lineNumbersWrapperHTML(): string {
    return `<span class="${LINE_NUMBERS_ROWS_CLASS}" contenteditable="false" aria-hidden="true"></span>`;
}

// Add or remove `<span>` children so wrapper.childElementCount === count.
// O(delta), not O(count) — typing within a line is free once the count
// matches.
export function syncLineNumbersSpans(wrapper: HTMLElement, count: number): void {
    let current = wrapper.childElementCount;
    while (current < count) {
        wrapper.appendChild(wrapper.ownerDocument.createElement('span'));
        current++;
    }
    while (current > count) {
        wrapper.lastElementChild!.remove();
        current--;
    }
}

// Measure the actual visual top of every logical line using Range API, then
// set `top` on each span so line numbers align correctly in wrap mode (where
// a single logical line can span multiple visual rows).
//
// Must run after layout (call via requestAnimationFrame).
export function repositionLineNumberSpans(
    wrapper: HTMLElement,
    codeEl: HTMLElement,
): void {
    const spans = Array.from(wrapper.children) as HTMLElement[];
    if (spans.length === 0)
        return;

    const text = codeEl.textContent ?? '';
    const wrapperTop = wrapper.getBoundingClientRect().top;

    // Global character offsets where each logical line begins.
    const lineStarts: number[] = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === LF)
            lineStarts.push(i + 1);
    }

    // Walk all text nodes once, positioning each span when we cross a line start.
    const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
    const range = document.createRange();

    let nodeStart = 0;
    let lineIdx = 0;
    let node = walker.nextNode() as Text | null;

    while (node !== null && lineIdx < lineStarts.length) {
        const nodeLen = (node.textContent ?? '').length;
        const nodeEnd = nodeStart + nodeLen;

        // A line start may be INSIDE this node (< nodeEnd); if it equals nodeEnd
        // it belongs to the next node and will be picked up on the next iteration.
        while (lineIdx < lineStarts.length && lineStarts[lineIdx] < nodeEnd) {
            const offsetInNode = lineStarts[lineIdx] - nodeStart;
            range.setStart(node, offsetInNode);
            range.collapse(true);
            const top = range.getBoundingClientRect().top - wrapperTop;
            if (lineIdx < spans.length)
                spans[lineIdx].style.top = `${top}px`;
            lineIdx++;
        }

        nodeStart = nodeEnd;
        node = walker.nextNode() as Text | null;
    }

    // Trailing empty line after a final "\n": no text node to measure from.
    // Place it one line-height below the previous span.
    if (lineIdx < spans.length) {
        const prevTop = lineIdx > 0 ? Number.parseFloat(spans[lineIdx - 1].style.top || '0') : 0;
        const lineH = Number.parseFloat(getComputedStyle(wrapper).lineHeight) || 24;
        for (let i = lineIdx; i < spans.length; i++) {
            spans[i].style.top = `${prevTop + lineH}px`;
        }
    }
}
