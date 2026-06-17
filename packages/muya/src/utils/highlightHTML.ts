import type { IHighlight } from '../inlineRenderer/types';
import { CLASS_NAMES } from '../config';
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
        const className = active ? CLASS_NAMES.MU_HIGHLIGHT : CLASS_NAMES.MU_SELECTION;
        let highlightContent = text.substring(start, end);
        if (handleLineEnding && text.endsWith('\n') && end === text.length) {
            highlightContent
                = highlightContent.substring(start, end - 1)
                    + (escape
                        ? getEscapeHTML(CLASS_NAMES.MU_LINE_END, '\n')
                        : `<span class="${CLASS_NAMES.MU_LINE_END}">\n</span>`);
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
                        ? getEscapeHTML(CLASS_NAMES.MU_LINE_END, '\n')
                        : `<span class="${CLASS_NAMES.MU_LINE_END}">\n</span>`);
        }
        else {
            code += text.substring(pos);
        }
    }

    return code;
}
