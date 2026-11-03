export const UNICODE_PUNCTUATION = /[\p{P}\p{S}]/u;
export const UNICODE_WHITESPACE = /[\p{Zs}\t\n\f\r]/u;

// Share MarkText's CJK emphasis extension (#4307), retaining the live editor's full supplementary range.
export const CJK_CHARACTER = /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uAC00-\uD7AF\uFF66-\uFF9D\u{20000}-\u{2FFFF}]/u;
