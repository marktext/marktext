import type { ITokenRange } from '../inline/model/types';
import type { Nullable } from '../types';
import type { IStringMatch } from '../utils/search';
import { CLASS_NAMES } from '../config';
import { getTextContent } from '../selection/dom';

const previewClasses = [CLASS_NAMES.MU_MATH_RENDER, CLASS_NAMES.MU_RUBY_RENDER];
const previewSelector = previewClasses.map(name => `.${name}`).join(', ');
const hiddenInline = `.${CLASS_NAMES.MU_HIDE}, .${CLASS_NAMES.MU_INLINE_IMAGE}, [hidden]`;
const hiddenBlock = [
    `.${CLASS_NAMES.MU_LANGUAGE_INPUT}`,
    `figure:not(.${CLASS_NAMES.MU_DISABLE_HTML_RENDER}) > .mu-html-container`,
    'figure > .mu-math-container',
    'figure > .mu-diagram-container',
].join(', ');

// Hidden syntax still takes up source offsets. Generated previews take up none.
function visibleSourceRanges(root: HTMLElement): ITokenRange[] {
    const ranges: ITokenRange[] = [];
    let offset = 0;

    function visit(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const length = (node as Text).length;
            if (!length)
                return;
            const last = ranges.at(-1);
            const end = offset + length;
            if (last?.end === offset)
                last.end = end;
            else
                ranges.push({ start: offset, end });
            offset = end;
        }
        else if (node instanceof Element && !node.matches(previewSelector)) {
            if (node.matches(hiddenInline)) {
                offset += getTextContent(node, previewClasses).length;
                return;
            }
            for (const child of node.childNodes)
                visit(child);
        }
    }

    visit(root);
    return ranges;
}

export function filterReadingMatches(root: Nullable<HTMLElement>, matches: IStringMatch[]): IStringMatch[] {
    if (!matches.length)
        return matches;
    if (!root || root.closest(hiddenBlock))
        return [];

    const ranges = visibleSourceRanges(root);
    let rangeIndex = 0;
    return matches.filter(({ index, match }) => {
        while (rangeIndex < ranges.length && ranges[rangeIndex].end <= index)
            rangeIndex++;
        const range = ranges[rangeIndex];
        return !!match.length && !!range && index >= range.start && index + match.length <= range.end;
    });
}
