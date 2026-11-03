export const UNICODE_PUNCTUATION = /[\p{P}\p{S}]/u;
export const UNICODE_WHITESPACE = /[\p{Zs}\t\n\f\r]/u;

// Preserve MarkText's CJK-adjacent emphasis extension in both parsing paths (#4307).
export const CJK_CHARACTER = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\uFF66-\uFF9D\u{20000}-\u{2A6DF}]/u;
