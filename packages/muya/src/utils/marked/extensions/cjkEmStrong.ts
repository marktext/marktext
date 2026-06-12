import type { MarkedExtension, TokenizerObject, Tokens } from 'marked';

// NON-STANDARD EXTENSION — a deliberate divergence from CommonMark.
//
// CommonMark §6.2 only counts Unicode whitespace and Unicode punctuation as
// emphasis flanking boundaries. CJK ideographs / Hangul / Kana are Lo
// (Letter, other) — neither whitespace nor punctuation — so under a literal
// reading of the spec `中文**"加粗"**中文` MUST NOT open a strong run. marked@16
// is spec-conformant here and refuses to bold it.
//
// But CJK scripts do not use spaces between words, so that rule denies
// emphasis to virtually any CJK paragraph that wraps the `**` run with
// punctuation (quotes, parentheses, brackets, …). Typora, VSCode
// markdownlint, Joplin and most CJK-oriented Markdown tools widen the flanking
// check so CJK counts as
// a boundary. This extension restores that behavior for the marked-based
// static / export render path.
//
// The widening is ADDITIVE: it only ever lets emphasis open/close where
// CommonMark refused, never the reverse, so spec-conformant Latin inputs
// parse identically (verified by the CommonMark / GFM conformance suites).
//
// Tracking: marktext/marktext#4307.

// CJK ranges treated as punctuation for flanking:
//   U+3040–U+30FF  Hiragana + Katakana
//   U+3400–U+4DBF  CJK Unified Ideographs Extension A
//   U+4E00–U+9FFF  CJK Unified Ideographs
//   U+F900–U+FAFF  CJK Compatibility Ideographs
//   U+AC00–U+D7AF  Hangul Syllables
//   U+FF66–U+FF9D  Halfwidth Katakana
const CJK = '\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7AF\\uFF66-\\uFF9D';
// CJK Unified Ideographs Extension B (non-BMP, U+20000–U+2A6DF) — matched as
// a full code point under the `u` flag inside the delimiter regexes.
const CJK_NON_BMP = '\\u{20000}-\\u{2A6DF}';
// A lone low surrogate can only be the trailing UTF-16 unit of a non-BMP code
// point. marked's lexer hands `emStrong` a single-unit `prevChar` (the last
// code unit of the preceding text token), so for an Ext-B ideograph that's a
// lone low surrogate. Accept it in the single-unit boundary test below.
const LOW_SURROGATE = '\\uDC00-\\uDFFF';

// Rebuild marked@16's emphasis flanking regexes (marked.cjs `emStrongLDelim`,
// `emStrongRDelimAst`, `emStrongRDelimUnd`, `punctuation`, and the `other`
// `unicodeAlphaNumeric` rule) with CJK folded into the punctuation class and
// removed from the alphanumeric class. Sources mirror marked@16.4.2 verbatim
// apart from substituting the CJK-widened character classes for `punct`,
// `punctSpace`, `notPunctSpace`. Under the `u` flag a single character class
// can mix BMP ranges with the non-BMP Ext-B range, so no surrogate-pair
// alternation is needed inside these classes.
const PUNCT = `[\\p{P}\\p{S}${CJK}${CJK_NON_BMP}]`;
const PUNCT_SPACE = `[\\s\\p{P}\\p{S}${CJK}${CJK_NON_BMP}]`;
const NOT_PUNCT_SPACE = `[^\\s\\p{P}\\p{S}${CJK}${CJK_NON_BMP}]`;

// These three patterns are verbatim copies of marked@16.4.2's emStrong
// delimiter regexes (only the punct/punctSpace/notPunctSpace classes are
// CJK-widened). The non-capturing groups and lazy quantifiers are marked's own
// shape — keeping them identical is the whole point, so the regexp/* lints that
// would "simplify" them are disabled to preserve upstream fidelity.
/* eslint-disable regexp/no-useless-non-capturing-group, regexp/no-useless-lazy */
const emStrongLDelim = new RegExp(
    `^(?:\\*+(?:((?!\\*)${PUNCT})|[^\\s*]))|^_+(?:((?!_)${PUNCT})|([^\\s_]))`,
    'u',
);
const emStrongRDelimAst = new RegExp(
    `^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)${PUNCT}(\\*+)(?=\\s|$)|${NOT_PUNCT_SPACE}(\\*+)(?!\\*)(?=${PUNCT_SPACE}|$)|(?!\\*)${PUNCT_SPACE}(\\*+)(?=${NOT_PUNCT_SPACE})|\\s(\\*+)(?!\\*)(?=${PUNCT})|(?!\\*)${PUNCT}(\\*+)(?!\\*)(?=${PUNCT})|${NOT_PUNCT_SPACE}(\\*+)(?=${NOT_PUNCT_SPACE})`,
    'gu',
);
const emStrongRDelimUnd = new RegExp(
    `^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)${PUNCT}(_+)(?=\\s|$)|${NOT_PUNCT_SPACE}(_+)(?!_)(?=${PUNCT_SPACE}|$)|(?!_)${PUNCT_SPACE}(_+)(?=${NOT_PUNCT_SPACE})|\\s(_+)(?!_)(?=${PUNCT})|(?!_)${PUNCT}(_+)(?!_)(?=${PUNCT})`,
    'gu',
);
/* eslint-enable regexp/no-useless-non-capturing-group, regexp/no-useless-lazy */
// `punctuation` and `unicodeAlphaNumeric` are tested against the single-unit
// `prevChar`, so they additionally fold in a lone low surrogate (the trailing
// half of an Ext-B ideograph) — see LOW_SURROGATE above.
const punctuation = new RegExp(
    `^(?![*_])[\\s\\p{P}\\p{S}${CJK}${CJK_NON_BMP}${LOW_SURROGATE}]`,
    'u',
);
// "Alphanumeric but not CJK" — a set difference, so it stays a lookahead-then-
// class rather than a single character class. Removing CJK from the
// alphanumeric set is what lets a CJK-preceded `**punct…` run open emphasis
// (marked's emStrong rejects an alphanumeric-preceded both-flanking opener).
const unicodeAlphaNumeric = new RegExp(
    `(?![${CJK}${CJK_NON_BMP}${LOW_SURROGATE}])[\\p{L}\\p{N}]`,
    'u',
);

interface IEmStrongRules {
    emStrongLDelim: RegExp;
    emStrongRDelimAst: RegExp;
    emStrongRDelimUnd: RegExp;
    punctuation: RegExp;
}

// `this` inside a marked TokenizerObject method is the internal `_Tokenizer`,
// which exposes `.rules` and `.lexer`. marked doesn't export that class, so we
// describe the slice we touch.
interface ITokenizerThis {
    rules: {
        inline: IEmStrongRules;
        other: { unicodeAlphaNumeric: RegExp };
    };
    lexer: { inlineTokens: (src: string) => Tokens.Generic[] };
}

/**
 * A faithful re-implementation of marked@16's `Tokenizer.emStrong`, identical
 * to the upstream body apart from swapping in the CJK-widened flanking rules
 * for the duration of the call. The rules are restored in a `finally` so the
 * shared `_Tokenizer.rules` object is never left mutated for other tokenizers.
 */
// eslint-disable-next-line complexity -- verbatim copy of marked's emStrong body
function cjkAwareEmStrong(
    this: ITokenizerThis,
    src: string,
    maskedSrc: string,
    prevChar = '',
): Tokens.Em | Tokens.Strong | undefined {
    const inline = this.rules.inline;
    const other = this.rules.other;
    const saved = {
        emStrongLDelim: inline.emStrongLDelim,
        emStrongRDelimAst: inline.emStrongRDelimAst,
        emStrongRDelimUnd: inline.emStrongRDelimUnd,
        punctuation: inline.punctuation,
        unicodeAlphaNumeric: other.unicodeAlphaNumeric,
    };

    inline.emStrongLDelim = emStrongLDelim;
    inline.emStrongRDelimAst = emStrongRDelimAst;
    inline.emStrongRDelimUnd = emStrongRDelimUnd;
    inline.punctuation = punctuation;
    other.unicodeAlphaNumeric = unicodeAlphaNumeric;

    try {
        let match = inline.emStrongLDelim.exec(src);
        if (!match)
            return undefined;

        // CommonMark §6.4: a `**`/`__` run that is both left- and right-flanking
        // can only open emphasis when preceded by punctuation. With CJK now in
        // the punctuation class, `unicodeAlphaNumeric` excludes CJK so this
        // guard no longer rejects CJK-preceded openers.
        if (match[3] && prevChar.match(other.unicodeAlphaNumeric))
            return undefined;

        const nextChar = match[1] || match[2] || '';

        if (!nextChar || !prevChar || inline.punctuation.exec(prevChar)) {
            // Unicode codepoints can be 1 or 2 chars wide.
            const lLength = [...match[0]].length - 1;
            let rDelim;
            let rLength;
            let delimTotal = lLength;
            let midDelimTotal = 0;

            const endReg
                = match[0][0] === '*'
                    ? inline.emStrongRDelimAst
                    : inline.emStrongRDelimUnd;
            endReg.lastIndex = 0;

            // Clip maskedSrc to the opener so the right-delimiter scan starts
            // immediately after the opening run (marked passes the masked,
            // already-skipped variant of `src`).
            maskedSrc = maskedSrc.slice(-1 * src.length + lLength);

            // eslint-disable-next-line no-cond-assign
            while ((match = endReg.exec(maskedSrc)) != null) {
                rDelim
                    = match[1]
                        || match[2]
                        || match[3]
                        || match[4]
                        || match[5]
                        || match[6];

                if (!rDelim)
                    continue;

                rLength = [...rDelim].length;

                if (match[3] || match[4]) {
                    // Found another opener — push the requirement deeper.
                    delimTotal += rLength;
                    continue;
                }
                else if ((match[5] || match[6]) && lLength % 3 && !((lLength + rLength) % 3)) {
                    // Rule of 3 — a delimiter run usable as both opener and
                    // closer can't close here.
                    midDelimTotal += rLength;
                    continue;
                }

                delimTotal -= rLength;
                if (delimTotal > 0)
                    continue;

                rLength = Math.min(rLength, rLength + delimTotal + midDelimTotal);

                const lastCharLength = [...match[0]][0].length;
                const raw = src.slice(0, lLength + match.index + lastCharLength + rLength);

                if (Math.min(lLength, rLength) % 2) {
                    const text = raw.slice(1, -1);
                    return {
                        type: 'em',
                        raw,
                        text,
                        tokens: this.lexer.inlineTokens(text),
                    } as Tokens.Em;
                }

                const text = raw.slice(2, -2);
                return {
                    type: 'strong',
                    raw,
                    text,
                    tokens: this.lexer.inlineTokens(text),
                } as Tokens.Strong;
            }
        }

        return undefined;
    }
    finally {
        inline.emStrongLDelim = saved.emStrongLDelim;
        inline.emStrongRDelimAst = saved.emStrongRDelimAst;
        inline.emStrongRDelimUnd = saved.emStrongRDelimUnd;
        inline.punctuation = saved.punctuation;
        other.unicodeAlphaNumeric = saved.unicodeAlphaNumeric;
    }
}

/**
 * marked extension that makes the emphasis/strong flanking check treat CJK
 * characters as punctuation. Register via `marked.use(cjkEmStrongExtension())`
 * on every Marked instance that renders inline emphasis.
 */
export default function cjkEmStrongExtension(): MarkedExtension {
    // marked's TokenizerObject.emStrong has `this: _Tokenizer` (a class marked
    // doesn't export). Our ITokenizerThis describes the slice we touch; the
    // cast bridges to marked's public TokenizerObject type.
    const tokenizer = {
        emStrong: cjkAwareEmStrong as unknown,
    } as TokenizerObject;

    return { tokenizer };
}
