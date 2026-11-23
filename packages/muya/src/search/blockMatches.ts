import type Content from '../block/base/content';
import type { IReadingSpan } from '../inline/readingText';
import type { IMatch, ISearchOption } from './types';
import { matchString } from '../utils/search';

export function matchBlock(block: Content, query: string, options: ISearchOption, readOnly: boolean): IMatch[] {
    if (!readOnly)
        return matchText(block, query, options);
    const matches: IMatch[] = [];
    const spans = block.getReadingSpans();
    let start = 0;
    for (let i = 0; i <= spans.length; i++) {
        if (i < spans.length && !spans[i].object)
            continue;
        if (start < i) {
            for (const match of matchText(block, query, options, spans.slice(start, i)))
                matches.push(match);
        }
        start = i + 1;
    }
    return matches;
}

function matchText(block: Content, query: string, options: ISearchOption, spans?: IReadingSpan[]): IMatch[] {
    const text = spans ? spans.map(span => span.text).join('') : block.text;
    let cursor = 0;
    let offset = 0;
    // Matches arrive in order. At a hidden delimiter the two endpoints belong to different spans.
    function sourceOffset(position: number, end: boolean): number {
        if (!spans)
            return position;
        const character = end ? position - 1 : position;
        while (character >= offset + spans[cursor].text.length) {
            offset += spans[cursor].text.length;
            cursor++;
        }
        const span = spans[cursor];
        if (span.end - span.start === span.text.length)
            return span.start + position - offset;
        return end ? span.end : span.start;
    }

    return matchString(text, query, options).filter(hit => !spans || hit.match.length > 0).map(({ index, match, subMatches }) => ({
        block,
        start: sourceOffset(index, false),
        end: sourceOffset(index + match.length, true),
        match,
        subMatches,
    }));
}
