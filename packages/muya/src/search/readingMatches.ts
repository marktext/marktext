import type Content from '../block/base/content';
import type { ITokenRange } from '../inline/model/types';
import type { IMatch, ISearchOption } from './types';
import { CLASS_NAMES } from '../config';
import { getTextContent } from '../selection/dom';
import { matchString } from '../utils/search';

const previewClasses = [CLASS_NAMES.MU_MATH_RENDER, CLASS_NAMES.MU_RUBY_RENDER];
const previewSelector = previewClasses.map(name => `.${name}`).join(', ');
const hiddenInline = `.${CLASS_NAMES.MU_HIDE}, .${CLASS_NAMES.MU_INLINE_IMAGE}, [hidden]`;
const hiddenBlock = [
    `.${CLASS_NAMES.MU_LANGUAGE_INPUT}`,
    '.mu-thematic-break-content',
    `figure:not(.${CLASS_NAMES.MU_DISABLE_HTML_RENDER}) > .mu-html-container`,
    'figure > .mu-math-container',
    'figure > .mu-diagram-container',
].join(', ');

interface IReadingSpan extends ITokenRange {
    textEnd: number;
    atomic: boolean;
}

function projectReadingText(block: Content, range?: ITokenRange) {
    const { domNode: root, text: source } = block;
    const spans: IReadingSpan[] = [];
    if (!root || root.closest(hiddenBlock))
        return { text: '', spans };

    const start = range?.start ?? 0;
    const end = range?.end ?? source.length;
    const parts: string[] = [];
    const view = root.ownerDocument.defaultView;
    let rootVisibility: string | undefined;
    let sourceOffset = 0;
    let textLength = 0;

    function append(text: string, from: number, to: number, atomic = false) {
        textLength += text.length;
        spans.push({ start: from, end: to, textEnd: textLength, atomic });
        parts.push(text);
    }

    const inlineVisibility = (node: Element, hiddenText: boolean): 'visible' | 'hidden-text' | 'hidden-subtree' => {
        if (node.matches(hiddenInline))
            return 'hidden-subtree';
        const style = node.classList.contains(CLASS_NAMES.MU_RAW_HTML) ? view?.getComputedStyle(node) : undefined;
        if (!style)
            return hiddenText ? 'hidden-text' : 'visible';
        if (style.display === 'none' || style.opacity === '0' || style.contentVisibility === 'hidden')
            return 'hidden-subtree';
        if (style.visibility !== 'hidden' && style.visibility !== 'collapse')
            return 'visible';

        // Tab layout can temporarily hide the entire editor while restoring its scroll position.
        rootVisibility ??= view?.getComputedStyle(root).visibility;
        const explicitVisibility = node instanceof HTMLElement && node.style.visibility;
        return hiddenText || explicitVisibility || style.visibility !== rootVisibility ? 'hidden-text' : 'visible';
    };

    function visitText(text: Text, hidden: boolean) {
        const nextOffset = sourceOffset + text.length;
        const from = Math.max(start, sourceOffset);
        const to = Math.min(end, nextOffset);
        if (!hidden && from < to)
            append(source.slice(from, to), from, to);
        sourceOffset = nextOffset;
    }

    function visitHidden(node: Element, hiddenText: boolean) {
        // A decoded glyph spans the whole source entity, including multi-unit characters.
        const nextOffset = sourceOffset + getTextContent(node, previewClasses).length;
        if (!hiddenText && sourceOffset < end && nextOffset > start && node.classList.contains(CLASS_NAMES.MU_HTML_ESCAPE)) {
            const glyph = node.getAttribute('data-character');
            if (glyph)
                append(glyph, sourceOffset, nextOffset, true);
        }
        sourceOffset = nextOffset;
    }

    function visit(node: Node, hiddenText = false) {
        if (sourceOffset >= end)
            return;
        if (node.nodeType === Node.TEXT_NODE) {
            visitText(node as Text, hiddenText);
            return;
        }
        if (!(node instanceof Element) || node.matches(previewSelector))
            return;

        const visibility = inlineVisibility(node, hiddenText);
        if (visibility === 'hidden-subtree') {
            // Hidden source occupies offsets used by selection, unlike generated previews.
            visitHidden(node, hiddenText);
            return;
        }
        for (const child of node.childNodes)
            visit(child, visibility === 'hidden-text');
    }

    visit(root);
    return { text: parts.join(''), spans };
}

export function getReadingText(block: Content, range: ITokenRange): string {
    return projectReadingText(block, range).text;
}

export function matchReadingText(block: Content, query: string, options: ISearchOption): IMatch[] {
    const { text, spans } = projectReadingText(block);
    const matches: IMatch[] = [];
    let spanIndex = 0;
    for (const { index, match, subMatches } of matchString(text, query, options)) {
        if (!match.length)
            continue;
        // At a gap in the source, a start belongs to the next visible span and an end to the previous one.
        while (spans[spanIndex].textEnd <= index)
            spanIndex++;
        const first = spans[spanIndex];
        const start = first.atomic ? first.start : first.end - (first.textEnd - index);

        const textEnd = index + match.length;
        while (spans[spanIndex].textEnd < textEnd)
            spanIndex++;
        const last = spans[spanIndex];
        const end = last.atomic ? last.end : last.end - (last.textEnd - textEnd);
        matches.push({ block, start, end, match, subMatches });
    }
    return matches;
}
