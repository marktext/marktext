import type { MarkedExtension, Tokens } from 'marked';
import { Tokenizer } from 'marked';

// Deliberate CommonMark divergence: treat CJK as punctuation at emphasis boundaries
// so CJK-adjacent runs such as 中文**"加粗"**中文 render bold (#4307).
const CJK = '\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7AF\\uFF66-\\uFF9D';
const CJK_NON_BMP = '\\u{20000}-\\u{2A6DF}';
// Marked supplies one UTF-16 unit as prevChar; an Ext-B character arrives as a low surrogate.
const LOW_SURROGATE = '\\uDC00-\\uDFFF';
const punctuation = new RegExp(
    `^(?![*_])[\\s\\p{P}\\p{S}${CJK}${CJK_NON_BMP}${LOW_SURROGATE}]`,
    'u',
);
const unicodeAlphaNumeric = new RegExp(
    `(?![${CJK}${CJK_NON_BMP}${LOW_SURROGATE}])[\\p{L}\\p{N}]`,
    'u',
);
const widenedRules = new WeakMap<RegExp, RegExp>();

function widenPunctuation(rule: RegExp): RegExp {
    let widened = widenedRules.get(rule);
    if (!widened) {
        // Preserve upstream capture groups and mode-specific rules, including GFM's tilde handling.
        widened = new RegExp(
            rule.source.replaceAll('\\p{P}\\p{S}', `\\p{P}\\p{S}${CJK}${CJK_NON_BMP}`),
            rule.flags,
        );
        widenedRules.set(rule, widened);
        widenedRules.set(widened, widened);
    }
    return widened;
}

function cjkAwareEmStrong(
    this: Tokenizer,
    src: string,
    maskedSrc: string,
    prevChar = '',
): Tokens.Em | Tokens.Strong | undefined {
    const rules = this.rules;
    // Marked shares grammar objects between lexers; keep the CJK change local to this call.
    this.rules = {
        ...rules,
        inline: {
            ...rules.inline,
            emStrongLDelim: widenPunctuation(rules.inline.emStrongLDelim),
            emStrongRDelimAst: widenPunctuation(rules.inline.emStrongRDelimAst),
            emStrongRDelimUnd: widenPunctuation(rules.inline.emStrongRDelimUnd),
            punctuation,
        },
        other: { ...rules.other, unicodeAlphaNumeric },
    };

    try {
        return Tokenizer.prototype.emStrong.call(this, src, maskedSrc, prevChar);
    }
    finally {
        this.rules = rules;
    }
}

export default function cjkEmStrongExtension(): MarkedExtension {
    return { tokenizer: { emStrong: cjkAwareEmStrong } };
}
