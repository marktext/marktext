import type { Lexer, MarkedExtension, Tokens } from 'marked';

// GitLab Flavored Markdown multiline blockquotes, fenced by `>>>` on both ends
// (GitLab's `BlockquoteFenceFilter` uses `^>>>\ *\n…\n>>>\ *$`). The fence must
// sit at column 0, so an indented `>>>` stays an indented code block and a
// fenced code block that merely contains `>>>` is never re-interpreted — those
// are consumed before this rule runs.
const RULE = /^>>>[ \t]*\n([\s\S]*?)\n>>>[ \t]*(?=\n|$)/;

interface IMultilineBlockquoteTokenizerThis {
    lexer: Lexer;
}
interface IMultilineBlockquoteRendererThis {
    parser?: { parse: (toks: Tokens.Generic[]) => string };
}

export interface IMultilineBlockquoteToken {
    type: 'multilineBlockquote';
    raw: string;
    text: string;
    tokens: Tokens.Generic[];
}

export default function multilineBlockquoteExtension(): MarkedExtension {
    return {
        extensions: [
            {
                name: 'multilineBlockquote',
                level: 'block',
                start(src: string) {
                    // Marked calls this with `src.slice(1)` to find where a
                    // paragraph must stop so the fence below is not swallowed.
                    const m = /\n>>>[ \t]*(?:\n|$)/.exec(src);
                    return m ? m.index + 1 : undefined;
                },
                tokenizer(src: string): IMultilineBlockquoteToken | undefined {
                    const match = RULE.exec(src);
                    if (!match)
                        return;

                    const [raw, text] = match;
                    // Lex the body with the bound lexer so nested content sees
                    // the same extensions (math, footnotes, …). A bare
                    // `new Lexer()` would fall back to global defaults.
                    // eslint-disable-next-line no-restricted-syntax
                    const { lexer } = this as unknown as IMultilineBlockquoteTokenizerThis;

                    return {
                        type: 'multilineBlockquote',
                        raw,
                        text,
                        tokens: lexer.blockTokens(text, []) as Tokens.Generic[],
                    };
                },
                renderer(token) {
                    if (token.type !== 'multilineBlockquote')
                        return false;
                    const t = token as IMultilineBlockquoteToken;
                    const { parser } = this as IMultilineBlockquoteRendererThis;
                    const inner = parser ? parser.parse(t.tokens) : '';

                    return `<blockquote>\n${inner}</blockquote>\n`;
                },
            },
        ],
    };
}
