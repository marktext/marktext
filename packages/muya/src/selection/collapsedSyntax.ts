import type Content from '../block/base/content';
import type { Token } from '../inlineRenderer/types';
import type { IAnchorFocusInfo } from './types';
import { CLASS_NAMES } from '../config';
import { tokenizer } from '../inlineRenderer/lexer';
import { getTextContent, resolveEndpoint } from './dom';

interface ICollapsedBoundary {
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

/** Snapshot before a drag reveals markers; source and preview DOM have different lengths. */
export function collapsedSyntaxBoundaries(block: Content): ICollapsedBoundary[] {
    const ranges = block.domNode ? hiddenSourceRanges(block.domNode) : [];
    if (!ranges.length)
        return ranges;
    const { options, editor: { inlineRenderer } } = block.muya;
    const tokens = tokenizer(block.text, { labels: inlineRenderer.labels, options });
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

/** A rendered replacement has no editable source positions between its two visual edges. */
export function collapsedPreviewEndpoint(target: Element | null, x: number, y: number): IAnchorFocusInfo | null {
    const content = target?.closest('span.mu-content');
    if (!content)
        return null;
    for (const element of content.querySelectorAll<HTMLElement>(`.${CLASS_NAMES.MU_HIDE}, .${CLASS_NAMES.MU_INLINE_IMAGE}`)) {
        if (!element.matches(PREVIEWS) && !element.querySelector(PREVIEWS))
            continue;
        const preview = element.classList.contains(CLASS_NAMES.MU_IMAGE_MARKED_TEXT) ? element.nextElementSibling : element;
        if (!preview)
            continue;
        const rect = preview.getBoundingClientRect();
        // Emoji glyphs sit to the left of their zero-width source span.
        const style = element.dataset.emoji ? getComputedStyle(element) : null;
        const left = rect.left - (style ? Number.parseFloat(style.marginLeft) : 0);
        const top = rect.top - (style ? Number.parseFloat(style.fontSize) : 0);
        if (x < left - 2 || x > rect.right + 2 || y < top || y > rect.bottom)
            continue;
        const start = resolveEndpoint(element, 0);
        if (!start)
            continue;
        const end = start.offset + getTextContent(element, [CLASS_NAMES.MU_MATH_RENDER, CLASS_NAMES.MU_RUBY_RENDER]).length;
        return { ...start, offset: x < (left + rect.right) / 2 ? start.offset : end };
    }
    return null;
}
