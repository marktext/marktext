import type { Token } from 'marked';
import type { IFrontmatterToken, ILexOption, TLexedToken } from './types';
import { Marked } from 'marked';
import compatibleTaskList from './compatibleTaskList';
import footnoteExtension from './extensions/footnote';
import mathExtension from './extensions/math';
import fm from './frontMatter';
import { DEFAULT_OPTIONS } from './options';
import walkTokens from './walkTokens';

/**
 * Depth-first token walk with the same visit order as `Marked.walkTokens`,
 * minus its return-value accumulation: marked's driver `concat`s every
 * callback result into one array, which clones that array once per token —
 * O(tokens²) on large documents (the dominant parse cost in #4887; our
 * callbacks return nothing, so the accumulation is pure waste).
 */
function walkTokensLinear(
    tokens: Token[],
    callback: (token: Token) => void,
): void {
    for (const token of tokens) {
        callback(token);

        switch (token.type) {
            case 'table': {
                for (const cell of token.header)
                    walkTokensLinear(cell.tokens, callback);
                for (const row of token.rows) {
                    for (const cell of row)
                        walkTokensLinear(cell.tokens, callback);
                }
                break;
            }
            case 'list': {
                walkTokensLinear(token.items, callback);
                break;
            }
            default: {
                if ('tokens' in token && token.tokens)
                    walkTokensLinear(token.tokens, callback);
            }
        }
    }
}

export function lexBlock(
    src: string,
    options: ILexOption = DEFAULT_OPTIONS,
): TLexedToken[] {
    options = Object.assign({}, DEFAULT_OPTIONS, options);
    const { math, frontMatter, footnote } = options;
    let tokens: (Token | IFrontmatterToken)[] = [];

    // Use a per-call Marked instance so extensions don't bleed across calls.
    // marked.use() on the global singleton would make math / footnote sticky:
    // any consumer that once passed `math: true` would get math parsing forever.
    const m = new Marked();

    if (math) {
        m.use(
            mathExtension({
                throwOnError: false,
                useKatexRender: false,
            }),
        );
    }

    if (footnote) {
        m.use(footnoteExtension());
    }

    if (frontMatter) {
        const { token, src: newSrc } = fm(src);
        if (token) {
            tokens.push(token);
            src = newSrc;
        }
    }

    // Pass `m.defaults` to the Lexer so the extensions registered via m.use()
    // are picked up; the no-arg constructor would fall back to global defaults.
    tokens.push(...new m.Lexer(m.defaults).blockTokens(src));
    tokens = compatibleTaskList(tokens as Token[]);
    walkTokensLinear(tokens as Token[], walkTokens(options));

    // After walkTokens / compatibleTaskList run, marked's Heading/List/ListItem
    // tokens have been augmented with muya-specific fields (headingStyle,
    // marker, listType, listItemType, bulletMarkerOrDelimiter). The wider
    // TLexedToken union captures that runtime shape.
    return tokens as TLexedToken[];
}
