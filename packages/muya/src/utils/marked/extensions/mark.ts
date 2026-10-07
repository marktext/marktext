import type { Lexer, MarkedExtension, Tokens } from 'marked';

// Marked's inline extension hooks are bound to a context exposing the active
// `lexer` (nested inline tokenisation) and `parser` (nested rendering), which
// the public hook typings do not surface. Narrow `this` once per hook, as the
// footnote extension does.
interface IMarkTokenizerThis {
    lexer: Lexer;
}
interface IMarkRendererThis {
    parser?: { parseInline: (tokens: Tokens.Generic[]) => string };
}

// Non-standard `==text==` highlight, also read by Obsidian, Typora, Logseq and
// Joplin. Mirrors the engine's `mark` inline rule (`rules.ts`); applied only
// when `highlightSyntax` is on.
// eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-unused-capturing-group
const MARK_RULE = /^(={2})(?=\S)([\s\S]*?\S)(\\*)\1/;
const MARK_START = /={2}(?=\S)/;

interface IMarkToken {
    type: 'mark';
    raw: string;
    text: string;
    marker: string;
    tokens: Tokens.Generic[];
}

export default function markExtension(): MarkedExtension {
    return {
        extensions: [
            {
                name: 'mark',
                level: 'inline',
                start(src: string) {
                    // Marked passes `src.slice(1)`, so the index found here is
                    // one short of the opener and lands the scan on `==`.
                    const match = src.match(MARK_START);
                    return match ? match.index : undefined;
                },
                tokenizer(src: string): IMarkToken | undefined {
                    const match = MARK_RULE.exec(src);
                    if (!match)
                        return;

                    // eslint-disable-next-line no-restricted-syntax
                    const { lexer } = this as unknown as IMarkTokenizerThis;

                    return {
                        type: 'mark',
                        raw: match[0],
                        text: match[2],
                        marker: match[1],
                        tokens: lexer.inlineTokens(match[2]),
                    };
                },
                renderer(token) {
                    const markToken = token as IMarkToken;
                    const { parser } = this as IMarkRendererThis;
                    const inner = parser
                        ? parser.parseInline(markToken.tokens)
                        : markToken.text;

                    return `<mark>${inner}</mark>`;
                },
            },
        ],
    };
}
