import type { IHighlight } from '../../../inlineRenderer/types';
import { escapeHTML } from '../../../utils';
import { getHighlightHtml, MARKER_HASH } from '../../../utils/highlightHTML';

// Escape a code-block language identifier for direct assignment to
// `domNode.innerHTML`: produce highlight markup with placeholder markers,
// escape the whole string (turning raw `<`, `>`, etc. into entities), then
// restore only the markers so legitimate `<span>` highlight wrappers survive.
//
// Without this, `<img/src=x/onerror=alert(1)>` typed into the language
// input would be injected verbatim (marktext fix 0dd09cc6 / #2548, #2601).
export function escapeLangInputInnerHtml(text: string, highlights: IHighlight[] = []) {
    return escapeHTML(getHighlightHtml(text, highlights, true))
        .replace(new RegExp(MARKER_HASH['<'], 'g'), '<')
        .replace(new RegExp(MARKER_HASH['>'], 'g'), '>')
        .replace(new RegExp(MARKER_HASH['"'], 'g'), '"')
        .replace(new RegExp(MARKER_HASH['\''], 'g'), '\'');
}
