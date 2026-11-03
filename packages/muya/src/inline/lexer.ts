import type { ITokenizerOptions } from './parser/types';
import { parseInline } from './parser/lexer';
import { applySearchHighlights } from './searchHighlights';

export function tokenizer(source: string, options: ITokenizerOptions = {}) {
    const tokens = parseInline(source, options);
    applySearchHighlights(tokens, options.highlights ?? []);
    return tokens;
}
