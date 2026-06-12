import type { Rules } from './types';
import { findClosingBracket } from '../utils/marked/utils';

// ASCII PUNCTUATION character
// export const punctuation = ['!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/', ':', ';', '<', '=', '>', '?', '@', '[', '\\', ']', '^', '_', '`', '{', '|', '}', '~']

export const PUNCTUATION_REG
    = /[!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDF3C-\uDF3E]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]/;

// selected from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
export const WHITELIST_ATTRIBUTES = [
    'align',
    'alt',
    'checked',
    'class',
    'color',
    'dir',
    'disabled',
    'for',
    'height',
    'hidden',
    'href',
    'id',
    'lang',
    'lazyload',
    'rel',
    'spellcheck',
    'src',
    'srcset',
    'start',
    'style',
    'target',
    'title',
    'type',
    'value',
    'width',
    // Used in img
    'data-align',
];

// export const unicodeZsCategory = [
//   '\u0020', '\u00A0', '\u1680', '\u2000', '\u2001', '\u2001',
//   '\u2002', '\u2003', '\u2004', '\u2005', '\u2006', '\u2007',
//   '\u2008', '\u2009', '\u200A', '\u202F', '\u205F', '\u3000'
// ]

// export const space = ['\u0020'] // space

// export const whitespaceCharacter = [
//   ...space, // space
//   '\u0009', // tab
//   '\u000A', // newline
//   '\u000B', // tabulation
//   '\u000C', // form feed
//   '\u000D' // carriage return
// ]

// export const unicodeWhitespaceCharacter = [
//   ...unicodeZsCategory,
//   '\u0009', // tab
//   '\u000D', // carriage return
//   '\u000A', // newline
//   '\u000C' // form feed
// ]

const UNICODE_WHITESPACE_REG = /^\s/;

// NON-STANDARD EXTENSION — a deliberate divergence from CommonMark.
//
// CommonMark §6.2 only counts Unicode whitespace and Unicode punctuation as
// emphasis flanking boundaries. CJK ideographs are Lo (Letter, other) —
// neither whitespace nor punctuation — so under a literal reading of the spec
// `中文**"加粗"**中文` MUST NOT open a strong run. But CJK scripts don't use
// spaces between words, so that denies emphasis to virtually any CJK paragraph
// that wraps the `**` run with punctuation (quotes, parentheses, brackets, …).
// Typora, VSCode markdownlint and Joplin all widen
// the flanking check so CJK counts as a boundary; we match that here so the
// live editor (inlineRenderer) bolds these spans consistently with the
// marked-based static / export render path.
//
// The widening is ADDITIVE: CJK is only ever accepted as an extra boundary on
// top of the CommonMark whitespace/punctuation set, never used to reject
// emphasis CommonMark accepts — so spec-conformant Latin inputs are unchanged.
//
// Ranges (BMP via the first alternative; CJK Ext-B non-BMP via the surrogate
// pair in the second):
//   U+3040–U+30FF  Hiragana + Katakana
//   U+3400–U+4DBF  CJK Unified Ideographs Extension A
//   U+4E00–U+9FFF  CJK Unified Ideographs
//   U+F900–U+FAFF  CJK Compatibility Ideographs
//   U+AC00–U+D7AF  Hangul Syllables
//   U+FF66–U+FF9D  Halfwidth Katakana
//   U+20000–U+2A6DF  CJK Unified Ideographs Extension B (D840-D87F DC00-DFFF)
//
// Tracking: marktext/marktext#4307.
// eslint-disable-next-line regexp/no-obscure-range
const CJK_REG = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯ｦ-ﾝ]|[\uD840-\uD87F][\uDC00-\uDFFF]/;

// Extract the trailing Unicode code point of `s` as a 1- or 2-char string, or
// '' when `s` is empty. Bracket indexing / charAt return a single UTF-16 code
// unit, splitting a non-BMP code point into raw surrogate halves that never
// match PUNCTUATION_REG / CJK_REG / UNICODE_WHITESPACE_REG. Reading the full
// code point keeps CJK_REG's surrogate-pair branch live for Ext-B ideographs.
function lastCodePointChar(s: string): string {
    if (!s)
        return '';
    const len = s.length;
    const lastUnit = s.charCodeAt(len - 1);
    if (lastUnit >= 0xDC00 && lastUnit <= 0xDFFF && len >= 2) {
        const prevUnit = s.charCodeAt(len - 2);
        if (prevUnit >= 0xD800 && prevUnit <= 0xDBFF)
            return s.slice(len - 2);
    }
    return s.charAt(len - 1);
}

// Same idea at an arbitrary index. Returns undefined past the end so the
// existing `|| '\n'` / `UNICODE_WHITESPACE_REG.test(undefined)` semantics at
// callers are preserved verbatim.
function codePointCharAt(s: string, i: number): string | undefined {
    if (i >= s.length)
        return undefined;
    const unit = s.charCodeAt(i);
    if (unit >= 0xD800 && unit <= 0xDBFF && i + 1 < s.length) {
        const next = s.charCodeAt(i + 1);
        if (next >= 0xDC00 && next <= 0xDFFF)
            return s.slice(i, i + 2);
    }
    return s.charAt(i);
}

function validWidthAndHeight(value: string) {
    if (!/^\d+$/.test(value))
        return '';
    const num = Number.parseInt(value);

    return num >= 0 ? num.toString() : '';
}

export function lowerPriority(src: string, offset: number, rules: Rules) {
    let i;
    const ignoreIndex: number[] = [];

    for (i = 0; i < offset; i++) {
        if (ignoreIndex.includes(i))
            continue;

        const text = src.substring(i);

        for (const [, regexp] of Object.entries(rules)) {
            const to = regexp.exec(text);
            if (to && to[0].length <= offset - i)
                ignoreIndex.push(i + to[0].length - 1);

            if (to && to[0].length > offset - i)
                return false;
        }
    }

    return true;
}

export function getAttributes(html: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const target = doc.querySelector('body')?.firstElementChild;
    if (!target)
        return null;
    const attrs: Record<string, string | null> = {};
    if (target.tagName === 'IMG') {
        Object.assign(attrs, {
            title: '',
            src: '',
            alt: '',
        });
    }

    for (const attr of target.getAttributeNames()) {
        if (!WHITELIST_ATTRIBUTES.includes(attr))
            continue;
        const attribute = target.getAttribute(attr);
        if (/width|height/.test(attr) && attribute)
            attrs[attr] = validWidthAndHeight(attribute);
        else
            attrs[attr] = attribute;
    }

    return attrs;
}

export function parseSrcAndTitle(text = '') {
    const parts = text.split(/\s+/);
    if (parts.length === 1) {
        return {
            src: text.trim(),
            title: '',
        };
    }
    const rawTitle = text.replace(/^[^ ]+ +/, '');
    let src = '';
    const TITLE_REG = /^('|")(.*?)\1$/; // we only support use `'` and `"` to indicate a title now.
    let title = '';
    if (rawTitle && TITLE_REG.test(rawTitle))
        title = rawTitle.replace(TITLE_REG, '$2');

    if (title)
        src = text.substring(0, text.length - rawTitle.length).trim();
    else
        src = text.trim();

    return { src, title };
}

function canOpenEmphasis(src: string, marker: string, pending: string) {
    // CommonMark §6.4 emphasis runs are atomic: once the FULL `_` or `*`
    // run has been rejected as an opener (because the surrounding chars
    // make it both left- and right-flanking), the lexer must not try to
    // re-open from the second char of the same run. Without this guard,
    // `пристаням__стремятся__` opens em starting at the second `_` because
    // `pending` then ends with `_` (a punctuation char) and the regular
    // flanking rule is satisfied — that's CommonMark example 387.
    const markerChar = marker.charAt(0);
    if (pending.length > 0 && pending.charAt(pending.length - 1) === markerChar)
        return false;

    const precededChar = lastCodePointChar(pending) || '\n';
    // Past end of src → '' (matches neither whitespace nor punctuation),
    // preserving the `RegExp.test(undefined)` semantics type-safely.
    const followedChar = codePointCharAt(src, marker.length) ?? '';
    // not followed by Unicode whitespace,
    if (UNICODE_WHITESPACE_REG.test(followedChar))
        return false;

    // and either (2a) not followed by a punctuation character,
    // or (2b) followed by a punctuation character and preceded by Unicode whitespace or a punctuation character.
    // For purposes of this definition, the beginning and the end of the line count as Unicode whitespace.
    // CJK widening (see CJK_REG above) — additive: a preceding CJK character is
    // accepted as a boundary on top of the CommonMark whitespace/punctuation set.
    if (
        PUNCTUATION_REG.test(followedChar)
        && !(
            UNICODE_WHITESPACE_REG.test(precededChar)
            || PUNCTUATION_REG.test(precededChar)
            || CJK_REG.test(precededChar)
        )
    ) {
        return false;
    }

    if (
        /_/.test(marker)
        && !(
            UNICODE_WHITESPACE_REG.test(precededChar)
            || PUNCTUATION_REG.test(precededChar)
            || CJK_REG.test(precededChar)
        )
    ) {
        return false;
    }

    return true;
}

function canCloseEmphasis(src: string, offset: number, marker: string) {
    const precededChar = lastCodePointChar(src.substring(0, offset - marker.length));
    const followedChar = codePointCharAt(src, offset) || '\n';
    // not preceded by Unicode whitespace,
    if (UNICODE_WHITESPACE_REG.test(precededChar))
        return false;

    // either (2a) not preceded by a punctuation character,
    // or (2b) preceded by a punctuation character and followed by Unicode whitespace or a punctuation character.
    // CJK widening: symmetric to canOpenEmphasis — a following CJK character is
    // accepted as a boundary on top of the CommonMark whitespace/punctuation set.
    if (
        PUNCTUATION_REG.test(precededChar)
        && !(
            UNICODE_WHITESPACE_REG.test(followedChar)
            || PUNCTUATION_REG.test(followedChar)
            || CJK_REG.test(followedChar)
        )
    ) {
        return false;
    }

    if (
        /_/.test(marker)
        && !(
            UNICODE_WHITESPACE_REG.test(followedChar)
            || PUNCTUATION_REG.test(followedChar)
            || CJK_REG.test(followedChar)
        )
    ) {
        return false;
    }

    return true;
}

export function validateEmphasize(src: string, offset: number, marker: string, pending: string, rules: Rules) {
    if (!canOpenEmphasis(src, marker, pending))
        return false;

    if (!canCloseEmphasis(src, offset, marker))
        return false;

    /**
     * 16.When there are two potential emphasis or strong emphasis spans with the same closing delimiter,
     * the shorter one (the one that opens later) takes precedence. Thus, for example, **foo **bar baz**
     * is parsed as **foo <strong>bar baz</strong> rather than <strong>foo **bar baz</strong>.
     */
    const mLen = marker.length;
    const emphasizeText = src.substring(mLen, offset - mLen);
    const SHORTER_REG = new RegExp(
        ` \\${marker.split('').join('\\')}[^\\${marker.charAt(0)}]`,
    );
    const CLOSE_REG = new RegExp(
        `[^\\${marker.charAt(0)}]\\${marker.split('').join('\\')}`,
    );
    if (SHORTER_REG.test(emphasizeText) && !CLOSE_REG.test(emphasizeText))
        return false;

    /**
     * 17.Inline code spans, links, images, and HTML tags group more tightly than emphasis.
     * So, when there is a choice between an interpretation that contains one of these elements
     * and one that does not, the former always wins. Thus, for example, *[foo*](bar) is parsed
     * as *<a href="bar">foo*</a> rather than as <em>[foo</em>](bar).
     */
    return lowerPriority(src, offset, rules);
}

export function correctUrl(token: string[] | null) {
    if (token && typeof token[4] === 'string') {
        const lastParenIndex = findClosingBracket(token[4], '()');

        if (lastParenIndex > -1) {
            const len = token[0].length - (token[4].length - lastParenIndex);
            token[0] = token[0].substring(0, len);
            const originSrc = token[4].substring(0, lastParenIndex);
            const match = /(\\+)$/.exec(originSrc);
            if (match) {
                token[4] = originSrc.substring(0, originSrc.length - match[1].length);
                token[5] = match[1];
            }
            else {
                token[4] = originSrc;
                token[5] = '';
            }
        }
    }
}
