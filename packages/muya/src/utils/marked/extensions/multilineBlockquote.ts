import type { Lexer, MarkedExtension, Tokens } from 'marked';

// GitLab's `BlockquoteFenceFilter` shape: `^>>>\ *\n…\n>>>\ *$`.
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
                    // Marked calls this with `src.slice(1)`.
                    const m = /\n>>>[ \t]*(?:\n|$)/.exec(src);
                    return m ? m.index + 1 : undefined;
                },
                tokenizer(src: string): IMultilineBlockquoteToken | undefined {
                    const match = RULE.exec(src);
                    if (!match)
                        return;

                    const [raw, text] = match;
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
