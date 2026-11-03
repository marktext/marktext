import type { EmojiToken, Token } from './model/types';
import { escapeHTML } from '../utils';
import { validEmoji } from '../utils/emoji';
import { tokenEvents } from './model/traversal';

function leafTokenToPlainText(token: Token): string {
    switch (token.type) {
        case 'text':
        case 'inline_code':
        case 'inline_diff':
        case 'inline_math':
        case 'super_sub_script':
        case 'footnote_identifier':
            return token.content;

        case 'emoji':
            return emojiDisplayText(token);

        case 'image':
        case 'reference_image':
            return token.attrs.alt;

        case 'html_tag':
            return token.content ?? '';

        case 'backlash':
            // `content` is empty; the escaped char is `raw` minus its leading `\`.
            return token.raw.replace(/^\\/, '');

        case 'html_escape':
            return token.content;

        case 'auto_link':
            // `<http://x>` / `<foo@bar.com>` show verbatim between the
            // angle brackets — `href` may carry an added `mailto:` scheme.
            return token.raw.replace(/^<|>$/g, '');

        case 'auto_link_extension':
            return token.raw;

        case 'soft_line_break':
        case 'hard_line_break':
            return ' ';

        // Begin markers, reference definitions and an atx heading's tail `#`s
        // carry no reader-facing text.
        default:
            return '';
    }
}

// The reader-facing text of inline tokens with every marker, delimiter, URL and
// tag dropped — `**bold**` → `bold`, `[text](url)` → `text`, `![alt](src)` →
// `alt`. Mirrors the visible `textContent` a rendered heading yields, so a slug
// derived from this matches the anchor id the HTML export injects
// (state/markdownToHtml.ts injects ids from `heading.textContent`). The TOC uses
// it to show and slug headings by their rendered text instead of raw source
// (#4811).
export function tokensToPlainText(tokens: Token[], lineBreak = ' '): string {
    const parts: string[] = [];
    for (const { token, exiting } of tokenEvents(tokens)) {
        if (exiting || ('children' in token && token.children))
            continue;
        parts.push(token.type === 'soft_line_break' || token.type === 'hard_line_break' ? lineBreak : leafTokenToPlainText(token));
    }
    return parts.join('');
}

// Unknown shortcodes fall back to the raw `:code:`, matching the editor.
function emojiDisplayText(token: EmojiToken): string {
    return validEmoji(token.content)?.emoji ?? token.raw;
}

function inlineDiffHtml(marker: string, content: string): string {
    const addition = marker[1] === '+';
    const tag = addition ? 'ins' : 'del';
    const variant = addition ? 'addition' : 'deletion';

    return `<${tag} class="idiff ${variant}">${escapeHTML(content)}</${tag}>`;
}

// HTML twin of `tokensToPlainText`, for the outline. Must keep the same text
// content as its plain counterpart so the shown heading and its slug stay in
// step, which is why links, images and math stay flattened to text.
export function tokensToInlineHtml(tokens: Token[]): string {
    const parts: string[] = [];
    for (const { token, exiting } of tokenEvents(tokens)) {
        if (token.type === 'strong' || token.type === 'em' || token.type === 'del' || token.type === 'mark') {
            parts.push(exiting ? `</${token.type}>` : `<${token.type}>`);
            continue;
        }
        if (exiting)
            continue;
        switch (token.type) {
            case 'inline_diff':
                parts.push(inlineDiffHtml(token.marker, token.content));
                break;
            case 'inline_code':
                parts.push(`<code>${escapeHTML(token.content)}</code>`);
                break;
            case 'super_sub_script': {
                const tag = token.marker === '^' ? 'sup' : 'sub';
                parts.push(`<${tag}>${escapeHTML(token.content)}</${tag}>`);
                break;
            }
            case 'link':
            case 'reference_link':
                break;
            case 'html_tag':
                if (!token.children && token.content)
                    parts.push(escapeHTML(token.content));
                break;
            default:
                parts.push(escapeHTML(leafTokenToPlainText(token)));
                break;
        }
    }
    return parts.join('');
}
