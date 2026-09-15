import { CLASS_NAMES } from '../config';

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

// Viewport tops of the logical lines in `codeEl`, in order. Lines at the end
// with nothing to measure are left out.
function measureLineTops(codeEl: HTMLElement): number[] {
    const text = codeEl.textContent ?? '';

    // Global character offsets where each logical line begins.
    const lineStarts: number[] = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === LF)
            lineStarts.push(i + 1);
    }

    // Walk all text nodes once, measuring each line where its start falls.
    const walker = document.createTreeWalker(codeEl, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const tops: number[] = [];

    let nodeStart = 0;
    let node = walker.nextNode() as Text | null;

    while (node !== null && tops.length < lineStarts.length) {
        const nodeEnd = nodeStart + node.data.length;

        // A line start may be INSIDE this node (< nodeEnd); if it equals nodeEnd
        // it belongs to the next node and will be picked up on the next iteration.
        while (tops.length < lineStarts.length && lineStarts[tops.length] < nodeEnd) {
            const offsetInNode = lineStarts[tops.length] - nodeStart;
            range.setStart(node, offsetInNode);
            // A caret position on an empty line has no client rect (#5294), so
            // an empty line is measured by its own newline.
            if (node.data.charCodeAt(offsetInNode) === LF)
                range.setEnd(node, offsetInNode + 1);
            else
                range.collapse(true);
            tops.push(range.getBoundingClientRect().top);
        }

        nodeStart = nodeEnd;
        node = walker.nextNode() as Text | null;
    }

    // The line after a final "\n" has no text of its own; CodeBlockContent
    // renders a trailing break there to give it a line box.
    const trailingBreak = codeEl.querySelector(`.${CLASS_NAMES.MU_TRAILING_BREAK}`);
    if (trailingBreak !== null && tops.length === lineStarts.length - 1)
        tops.push(trailingBreak.getBoundingClientRect().top);

    return tops;
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

    const tops = measureLineTops(codeEl);
    const measuredCount = Math.min(tops.length, spans.length);
    // Origin = the measured top of the first logical line. A measured top sits
    // at the text box (below the line-box leading), so subtracting the wrapper
    // top would offset every number down by that constant leading. Anchoring to
    // the first line cancels it and keeps line 1 flush with the gutter top,
    // while preserving correct per-line deltas for wrap mode.
    for (let i = 0; i < measuredCount; i++)
        spans[i].style.top = `${tops[i] - tops[0]}px`;

    // Lines with nothing to measure: the single line of a wholly empty code
    // block, or a final empty line rendered without a trailing break. The first
    // line is always flush with the top; later ones stack one line-height below
    // their predecessor.
    if (measuredCount < spans.length) {
        const lineH = Number.parseFloat(getComputedStyle(wrapper).lineHeight) || 24;
        for (let i = measuredCount; i < spans.length; i++) {
            const prevTop = i > 0 ? Number.parseFloat(spans[i - 1].style.top || '0') : 0;
            spans[i].style.top = i > 0 ? `${prevTop + lineH}px` : '0px';
        }
    }
}
