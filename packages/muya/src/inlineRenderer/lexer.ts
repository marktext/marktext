import type { ITokenizerOptions } from './parser/types';
import { parseInline } from './parser/lexer';
import { applySearchHighlights } from './searchHighlights';

export { parseInline } from './parser/lexer';
export { tokensToInlineHtml, tokensToPlainText } from './projection';
export { generator } from './serialization';

/** Compatibility pipeline: parsing is independent of search decorations. */
export function tokenizer(source: string, options: ITokenizerOptions = {}) {
    const tokens = parseInline(source, options);
    applySearchHighlights(tokens, options.highlights ?? []);
    return tokens;
}
