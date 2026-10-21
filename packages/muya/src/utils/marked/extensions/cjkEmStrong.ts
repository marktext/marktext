import type { MarkedExtension, TokenizerObject, Tokens } from 'marked';

// Deliberate CommonMark divergence: treat CJK as punctuation at emphasis boundaries
// so CJK-adjacent runs such as 中文**"加粗"**中文 render bold (#4307).

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
// marked supplies one UTF-16 unit as prevChar; an Ext-B character arrives as a low surrogate.
const LOW_SURROGATE = '\\uDC00-\\uDFFF';

// Rebuild marked’s flanking character classes with CJK included as punctuation.
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
// prevChar can be a lone low surrogate; include it in the punctuation classes.
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

interface ITokenizerThis {
    rules: {
        inline: IEmStrongRules;
        other: { unicodeAlphaNumeric: RegExp };
    };
    lexer: { inlineTokens: (src: string) => Tokens.Generic[] };
}

// Scan closing delimiters with CommonMark rule-of-three balancing; opener is already matched.
function scanEmphasisRun(
    src: string,
    maskedSrc: string,
    opener: RegExpExecArray,
    inline: IEmStrongRules,
    lexer: ITokenizerThis['lexer'],
): Tokens.Em | Tokens.Strong | undefined {
    const lLength = [...opener[0]].length - 1;
    let rDelim;
    let rLength;
    let delimTotal = lLength;
    let midDelimTotal = 0;

    const endReg
        = opener[0][0] === '*'
            ? inline.emStrongRDelimAst
            : inline.emStrongRDelimUnd;
    endReg.lastIndex = 0;

    // Clip maskedSrc to the opener so the right-delimiter scan starts
    // immediately after the opening run (marked passes the masked,
    // already-skipped variant of `src`).
    maskedSrc = maskedSrc.slice(-1 * src.length + lLength);

    let match: RegExpExecArray | null;
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
                tokens: lexer.inlineTokens(text),
            } as Tokens.Em;
        }

        const text = raw.slice(2, -2);
        return {
            type: 'strong',
            raw,
            text,
            tokens: lexer.inlineTokens(text),
        } as Tokens.Strong;
    }

    return undefined;
}

// Apply the CJK flanking rules only for this call and restore shared tokenizer rules afterward.
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
        const match = inline.emStrongLDelim.exec(src);
        if (!match)
            return undefined;

        // CommonMark §6.4: a `**`/`__` run that is both left- and right-flanking
        // can only open emphasis when preceded by punctuation. With CJK now in
        // the punctuation class, `unicodeAlphaNumeric` excludes CJK so this
        // guard no longer rejects CJK-preceded openers.
        if (match[3] && prevChar.match(other.unicodeAlphaNumeric))
            return undefined;

        const nextChar = match[1] || match[2] || '';

        if (!nextChar || !prevChar || inline.punctuation.exec(prevChar))
            return scanEmphasisRun(src, maskedSrc, match, inline, this.lexer);

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

// Register on each Marked instance that renders emphasis. Latin flanking rules remain unchanged.
export default function cjkEmStrongExtension(): MarkedExtension {
    // marked’s internal Tokenizer type is not exported; bridge the structural slice to its public hook type.
    const tokenizer = {
        emStrong: cjkAwareEmStrong as unknown,
    } as TokenizerObject;

    return { tokenizer };
}
