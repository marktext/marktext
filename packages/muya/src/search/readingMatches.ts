import type Content from '../block/base/content';
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

interface IReadingSpan {
    sourceEnd: number;
    textEnd: number;
}

function projectReadingText(root: HTMLElement, source: string) {
    const spans: IReadingSpan[] = [];
    const parts: string[] = [];
    const view = root.ownerDocument.defaultView;
    let rootVisibility: string | undefined;
    let sourceOffset = 0;
    let textLength = 0;

    function inlineVisibility(node: Element, hiddenText: boolean): 'visible' | 'hidden-text' | 'hidden-subtree' {
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
    }

    function visit(node: Node, hiddenText = false) {
        if (node.nodeType === Node.TEXT_NODE) {
            const length = (node as Text).length;
            const end = sourceOffset + length;
            if (!hiddenText && sourceOffset < end && sourceOffset < source.length) {
                const part = source.slice(sourceOffset, end);
                textLength += part.length;
                spans.push({ sourceEnd: sourceOffset + part.length, textEnd: textLength });
                parts.push(part);
            }
            sourceOffset = end;
            return;
        }
        if (!(node instanceof Element) || node.matches(previewSelector))
            return;

        const visibility = inlineVisibility(node, hiddenText);
        if (visibility === 'hidden-subtree') {
            // Hidden source occupies offsets used by selection, unlike generated previews.
            sourceOffset += getTextContent(node, previewClasses).length;
            return;
        }
        for (const child of node.childNodes)
            visit(child, visibility === 'hidden-text');
    }

    visit(root);
    return { text: parts.join(''), spans };
}

export function matchReadingText(block: Content, query: string, options: ISearchOption): IMatch[] {
    const { domNode: root } = block;
    if (!root || root.closest(hiddenBlock))
        return [];

    const { text, spans } = projectReadingText(root, block.text);
    const matches: IMatch[] = [];
    let spanIndex = 0;
    for (const { index, match, subMatches } of matchString(text, query, options)) {
        if (!match.length)
            continue;
        // At a gap in the source, a start belongs to the next visible span and an end to the previous one.
        while (spans[spanIndex].textEnd <= index)
            spanIndex++;
        const first = spans[spanIndex];
        const start = first.sourceEnd - (first.textEnd - index);

        const textEnd = index + match.length;
        while (spans[spanIndex].textEnd < textEnd)
            spanIndex++;
        const last = spans[spanIndex];
        const end = last.sourceEnd - (last.textEnd - textEnd);
        matches.push({ block, start, end, match, subMatches });
    }
    return matches;
}
