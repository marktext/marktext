import type { MarkedExtension, Token } from 'marked';
import type { IGithubAlertState } from '../../../state/types';
import { Lexer } from 'marked';
import { VOID_HTML_TAGS } from '../../../config';
import { githubAlertIcon, githubAlertTitle, matchGithubAlertMarker } from '../../githubAlerts';

export interface IGithubAlertToken {
    type: 'githubAlert';
    raw: string;
    meta: IGithubAlertState['meta'];
    tokens: Token[];
}

function trackHtmlParents(html: string, parents: string[]) {
    for (const match of html.matchAll(/<!--[\s\S]*?-->|<\/?([a-z][\w:-]*)\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi)) {
        const tag = match[1]?.toLowerCase();
        if (!tag || (VOID_HTML_TAGS as readonly string[]).includes(tag) || match[0].endsWith('/>'))
            continue;
        if (match[0].startsWith('</')) {
            const open = parents.lastIndexOf(tag);
            if (open >= 0)
                parents.splice(open);
        }
        else {
            parents.push(tag);
        }
    }
}

/** Only root tokens are eligible; nested quotes keep their Markdown semantics. */
export function normalizeGithubAlertTokens(tokens: Token[], lexer: Lexer): void {
    const htmlParents: string[] = [];
    for (let index = 0; index < tokens.length; index++) {
        const quote = tokens[index];
        if (quote.type === 'html')
            trackHtmlParents(quote.raw, htmlParents);
        if (htmlParents.length || quote.type !== 'blockquote' || !quote.tokens)
            continue;
        const firstIndex = quote.tokens.findIndex((token: Token) => token.type !== 'space');
        const first = quote.tokens[firstIndex];
        if (first?.type !== 'paragraph')
            continue;
        const newline = first.text.indexOf('\n');
        const marker = newline < 0 ? first.text : first.text.slice(0, newline);
        const type = matchGithubAlertMarker(marker);
        if (!type)
            continue;
        const inline = first.tokens?.length ? first.tokens : lexer.inlineTokens(first.text);
        if (inline[0]?.type === 'link')
            continue;
        const body = quote.tokens.slice(firstIndex + 1);
        if (newline >= 0) {
            const text = first.text.slice(newline + 1);
            if (text.trim())
                body.unshift({ ...first, raw: text, text, tokens: lexer.inlineTokens(text) });
        }
        if (!body.some((token: Token) => token.type !== 'space' && token.type !== 'def' && token.raw.trim()))
            continue;
        tokens[index] = {
            type: 'githubAlert',
            raw: quote.raw,
            meta: { type, ...(marker === `[!${type}]` ? {} : { marker }), ...(/\n[ \t]*\n/.test(first.raw) ? { blankLineAfterMarker: true } : {}) },
            tokens: body,
        };
    }
}

export default function githubAlertsExtension(enabled: boolean): MarkedExtension {
    if (!enabled)
        return {};
    return {
        hooks: {
            processAllTokens(tokens) {
                const lexer = new Lexer(this.options);
                if ('links' in tokens)
                    lexer.tokens.links = tokens.links;
                normalizeGithubAlertTokens(tokens, lexer);
                return tokens;
            },
        },
        extensions: [{
            name: 'githubAlert',
            childTokens: ['tokens'],
            renderer(token) {
                const { meta, tokens } = token as IGithubAlertToken;
                return `<div class="markdown-alert markdown-alert-${meta.type.toLowerCase()}"><p class="markdown-alert-title">${githubAlertIcon(meta.type)}${githubAlertTitle(meta.type)}</p>\n${this.parser.parse(tokens)}</div>\n`;
            },
        }],
    };
}
