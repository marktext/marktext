import type { Token } from './types';
import { CLASS_NAMES } from '../config';
import { getTextContent } from '../selection/dom';

export interface ICollapsedBoundary {
    start: number;
    end: number;
    offset: number;
}

const PREVIEWS = `.${CLASS_NAMES.MU_MATH_RENDER}, .${CLASS_NAMES.MU_RUBY_RENDER}, .${CLASS_NAMES.MU_IMAGE_MARKED_TEXT}, .${CLASS_NAMES.MU_INLINE_IMAGE}, img, [data-emoji], [data-character]`;

function hiddenSourceRanges(dom: HTMLElement): ICollapsedBoundary[] {
    const candidates: ICollapsedBoundary[] = [];
    let offset = 0;
    const visit = (node: Node, excluded = false): boolean => {
        if (node.nodeType === Node.TEXT_NODE) {
            offset += (node as Text).length;
            return false;
        }
        if (!(node instanceof Element))
            return false;
        if (node.classList.contains(CLASS_NAMES.MU_MATH_RENDER) || node.classList.contains(CLASS_NAMES.MU_RUBY_RENDER))
            return true;
        if (node.classList.contains(CLASS_NAMES.MU_INLINE_IMAGE)) {
            offset += getTextContent(node, [CLASS_NAMES.MU_MATH_RENDER, CLASS_NAMES.MU_RUBY_RENDER]).length;
            return true;
        }

        // The hidden HTML spelling of <br> owns a visible line break, not a zero-width delimiter.
        const isPreview = node.matches(PREVIEWS) || node.nextElementSibling?.tagName === 'BR';
        const boundary = !excluded && !isPreview && node.classList.contains(CLASS_NAMES.MU_HIDE)
            ? { start: offset, end: offset, offset }
            : null;
        if (boundary)
            candidates.push(boundary);
        let hasPreview = isPreview || node.tagName === 'BR';
        for (const child of node.childNodes)
            hasPreview = visit(child, excluded || isPreview) || hasPreview;
        if (boundary && !hasPreview)
            boundary.end = offset;
        return hasPreview;
    };
    visit(dom);

    const ranges: ICollapsedBoundary[] = [];
    for (const candidate of candidates) {
        if (candidate.start === candidate.end)
            continue;
        const previous = ranges[ranges.length - 1];
        if (previous && candidate.start <= previous.end)
            previous.end = Math.max(previous.end, candidate.end);
        else
            ranges.push(candidate);
    }
    return ranges;
}

/** Reuse the render's tokens so mouse selection never needs to parse the document. */
export function collapsedSyntaxBoundaries(dom: HTMLElement, tokens: Token[]): ICollapsedBoundary[] {
    const ranges = hiddenSourceRanges(dom);
    if (!ranges.length)
        return ranges;
    let index = 0;
    const visit = (tokens: Token[]) => {
        for (const token of tokens) {
            // Children close before their parent; token ends and ranges can then advance together.
            if ('children' in token && Array.isArray(token.children))
                visit(token.children);
            const { start, end } = token.range;
            while (index < ranges.length && ranges[index].end < end)
                index++;
            const range = ranges[index];
            // Adjacent formats share a visual edge: stop after the closing token, before the next opener.
            if (range && start < range.start && end > range.start)
                range.offset = end;
        }
    };
    visit(tokens);
    return ranges;
}

export function snapToCollapsedSyntax(offset: number, boundaries: readonly ICollapsedBoundary[]): number {
    let left = 0;
    let right = boundaries.length;
    while (left < right) {
        const middle = (left + right) >>> 1;
        if (boundaries[middle].end < offset)
            left = middle + 1;
        else
            right = middle;
    }
    const boundary = boundaries[left];
    return boundary && offset >= boundary.start ? boundary.offset : offset;
}
