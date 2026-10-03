import type { IHighlight } from '../inlineRenderer/types';
import { resolveHighlightClass } from '../inlineRenderer/highlightClass';
import { getLongUniqueId } from '../utils';

// TODO: @jocs any better solutions?
export const MARKER_HASH = {
    '<': `%${getLongUniqueId()}%`,
    '>': `%${getLongUniqueId()}%`,
    '"': `%${getLongUniqueId()}%`,
    '\'': `%${getLongUniqueId()}%`,
};

function spanHtml(light: IHighlight, content: string, escape: boolean) {
    const className = resolveHighlightClass(light);
    const data = light.dataId
        ? ` data-comment-id=${escape ? MARKER_HASH['"'] : '"'}${light.dataId}${escape ? MARKER_HASH['"'] : '"'}`
        : '';

    if (!escape)
        return `<span class="${className}"${data}>${content}</span>`;

    return `${MARKER_HASH['<']}span class=${MARKER_HASH['"']}${className}${MARKER_HASH['"']}${data}${MARKER_HASH['>']}${content}${MARKER_HASH['<']}/span${MARKER_HASH['>']}`;
}

export function getHighlightHtml(text: string, highlights: IHighlight[], escape = false) {
    let code = '';
    let pos = 0;

    for (const highlight of highlights) {
        const { start, end } = highlight;
        code += text.substring(pos, start);
        code += spanHtml(highlight, text.substring(start, end), escape);
        pos = end;
    }

    return code + text.substring(pos);
}
