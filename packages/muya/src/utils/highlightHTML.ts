import type { IHighlight } from '../inlineRenderer/types';
import { getLongUniqueId } from '../utils';

// TODO: @jocs any better solutions?
export const MARKER_HASH = {
    '<': `%${getLongUniqueId()}%`,
    '>': `%${getLongUniqueId()}%`,
    '"': `%${getLongUniqueId()}%`,
    '\'': `%${getLongUniqueId()}%`,
};

export function getHighlightHtml(text: string, highlights: IHighlight[], escape = false, handleLineEnding = false) {
    let code = '';
    let pos = 0;

    const getEscapeHTML = (className: string, content: string) => {
        return `${MARKER_HASH['<']}span class=${MARKER_HASH['"']}${className}${MARKER_HASH['"']}${MARKER_HASH['>']}${content}${MARKER_HASH['<']}/span${MARKER_HASH['>']}`;
    };

    for (const highlight of highlights) {
        const { start, end, active } = highlight;
        code += text.substring(pos, start);
        const className = active ? 'mu-highlight' : 'mu-selection';
        let highlightContent = text.substring(start, end);
        if (handleLineEnding && text.endsWith('\n') && end === text.length) {
            highlightContent
                = highlightContent.substring(start, end - 1)
                    + (escape
                        ? getEscapeHTML('mu-line-end', '\n')
                        : '<span class="mu-line-end">\n</span>');
        }
        code += escape
            ? getEscapeHTML(className, highlightContent)
            : `<span class="${className}">${highlightContent}</span>`;
        pos = end;
    }

    if (pos !== text.length) {
        if (handleLineEnding && text.endsWith('\n')) {
            code
                += text.substring(pos, text.length - 1)
                    + (escape
                        ? getEscapeHTML('mu-line-end', '\n')
                        : '<span class="mu-line-end">\n</span>');
        }
        else {
            code += text.substring(pos);
        }
    }

    return code;
}
