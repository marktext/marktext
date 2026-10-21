import type { IHighlight } from '../../../inlineRenderer/types';
import { escapeHTML } from '../../../utils';
import { getHighlightHtml, MARKER_HASH } from '../../../utils/highlightHTML';

// Escape all language text before restoring generated highlight markup.
// Authored HTML must never reach innerHTML unescaped.
export function escapeLangInputInnerHtml(text: string, highlights: IHighlight[] = []) {
    return escapeHTML(getHighlightHtml(text, highlights, true))
        .replace(new RegExp(MARKER_HASH['<'], 'g'), '<')
        .replace(new RegExp(MARKER_HASH['>'], 'g'), '>')
        .replace(new RegExp(MARKER_HASH['"'], 'g'), '"')
        .replace(new RegExp(MARKER_HASH['\''], 'g'), '\'');
}
