import type { Lexer, MarkedExtension, Tokens } from 'marked';

interface IMarkTokenizerThis {
    lexer: Lexer;
}
interface IMarkRendererThis {
    parser?: { parseInline: (tokens: Tokens.Generic[]) => string };
}

// eslint-disable-next-line regexp/no-super-linear-backtracking
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
                    // `src` is `originalSrc.slice(1)` in marked's inline scan.
                    const match = src.match(MARK_START);
                    return match ? match.index : undefined;
                },
                tokenizer(src: string): IMarkToken | undefined {
                    const match = MARK_RULE.exec(src);
                    if (!match)
                        return;

                    const backslashes = match[3];
                    if (backslashes.length % 2 !== 0)
                        return;

                    // eslint-disable-next-line no-restricted-syntax
                    const { lexer } = this as unknown as IMarkTokenizerThis;
                    const content = match[2] + backslashes;

                    return {
                        type: 'mark',
                        raw: match[0],
                        text: content,
                        marker: match[1],
                        tokens: lexer.inlineTokens(content),
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
