import type { IHighlight, ITokenRange } from './types';
import { union as intersectRanges } from '../../utils';

function firstHighlightEndingAfter(highlights: readonly IHighlight[], offset: number): number {
    let start = 0;
    let end = highlights.length;

    while (start < end) {
        const middle = Math.floor((start + end) / 2);
        if (highlights[middle].end <= offset)
            start = middle + 1;
        else
            end = middle;
    }

    return start;
}

export function intersectingHighlights(
    range: ITokenRange,
    highlights: readonly IHighlight[],
): IHighlight[] {
    const matches: IHighlight[] = [];
    const first = firstHighlightEndingAfter(highlights, range.start);

    for (let i = first; i < highlights.length; i++) {
        const highlight = highlights[i];
        if (highlight.start >= range.end)
            break;

        const intersection = intersectRanges(range, highlight);
        if (intersection)
            matches.push(intersection);
    }

    return matches;
}

/** Source partitions retain syntax characters even when their presentation is hidden. */
export function delimitedRanges(range: ITokenRange, openingLength: number, closingLength = openingLength, contentRange?: ITokenRange) {
    const content = contentRange ?? { start: range.start + openingLength, end: range.end - closingLength };
    return {
        opening: { start: range.start, end: content.start },
        content,
        closing: { start: content.end, end: range.end },
    };
}
