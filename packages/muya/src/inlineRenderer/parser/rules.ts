import { ASCII_PUNCTUATION, CHARACTER_REFERENCE } from '../../utils/markdownEscape';
import { rawHtmlToken } from './rawHtml';

export const beginRules = {
    hr: /^(\*{3,}|-{3,}|_{3,})$/,
    // Backtick fences may not carry a backtick in their info string, while
    // tilde fences may carry either fence character (CommonMark §4.5) — hence
    // the asymmetric info-string classes. `matchPrefix` reads the marker
    // and content from whichever alternative matched.
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    code_fence: /^(`{3,})([^`]*)$|^(~{3,})(.*)$/,
    header: /(^ {0,3}#{1,6}(\s+|$))/,
    reference_definition:
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group
    /^( {0,3}\[)((?:\\.|[^[\]\\]){1,999}?)(\\*)(\]:[ \t]*)(<?)([^\s>]+)(>?)(?:([ \t]+)(["'(]?)([^\n"'()]+)\9)?([ \t]*)$/,

    // extra syntax (not belongs to GFM)
    multiple_math: /^(\$\$)$/,
};

export const endRules = {
    tail_header: /^(\s+#+)(\s*)$/,
};

export type BeginRules = typeof beginRules;

export const commonMarkRules = {
    html_tag: rawHtmlToken,
    html_escape: new RegExp(`^${CHARACTER_REFERENCE.source}`, 'i'),
    soft_line_break: /^[ \t]*(\n)(?!\n)[ \t]*/,
    // Tabs may precede the two trailing spaces; the lookahead keeps this scan linear.
    hard_line_break: /^((?=[ \t]* {2}\n)[ \t]+|\\)(\n)(?!\n)( *)/,

    backlash: new RegExp(`^(\\\\)(${ASCII_PUNCTUATION.source})`),
};

export type CommonMarkRules = typeof commonMarkRules;

export const gfmRules = {
    emoji: /^(:)([a-z_\d+-]+)\1/,
    auto_link:
    /^<(?:([a-z][a-z\d+.\-]{1,31}:[^ <>]*)|([\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*))>/i,
    // (extended www autolink|extended url autolink|extended email autolink) the email regexp is the same as auto_link.
    auto_link_extension:
    /^(?:(www\.[a-z_-]+\.[a-z]{2,}(?![\w-])[^\s<]*)|((?:https?|ftp):\/\/(?:[a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(?![\w-])[^\s<]*)|([\w.!#$%&'*+/=?^`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*))(?=[\s?!,:*~()<>]|\.(?![\w-])|$)/,
};

export type GfmRules = typeof gfmRules;

// Markdown extensions (not belongs to GFM and Commonmark)
export const inlineExtensionRules = {
    // `$$...$$` is display math and may contain a lone `$`; `$...$` may not.
    // A `$...$` span also carries pandoc's three `tex_math_dollars` rules, so
    // that prose like "Revenue rose from $13B to $24B." is not a formula
    // (#5446): a non-space right after the opener, a non-space right before
    // the closer, and no digit right after the closer. pandoc exempts display
    // math from all three — hence the leading veto, which starts on a single
    // `$` and so never engages for `$$`. The veto can read the closer off the
    // first unescaped `$` because a single-`$` span may not contain one.
    inline_math: /^(?!\$(?!\$)(?:[^$\\]|\\.)*(?:\s\$|\$\d))(\$\$(?!\$)|\$(?=\S))((?:(?!\1)[^\\]|\\.)+)\1(?!\1)/,
    // GitHub's inline math, the other half of pandoc's `tex_math_gfm` (#5446).
    // Opener and closer are mirror images rather than the same string, but both
    // are two characters wide, so the marker arithmetic every consumer does off
    // `marker.length` still lands on the right side of the formula.
    inline_math_gfm: /^(\$`)((?:[^`\\]|\\.)+)`\$/,
    // pandoc's `tex_math_single_backslash` (#5446). One rule per delimiter pair,
    // because opener and closer are different strings and so cannot be closed by
    // a `\1` backreference. Both are two characters wide, so the marker
    // arithmetic every consumer does off `marker.length` still lands on the far
    // side of the formula. `\\[^)]` is pandoc's escape rule inside a formula: a
    // backslash consumes the character behind it, so `\\` is a literal backslash
    // and `\\)` does not close the span. A newline may sit inside a formula —
    // pandoc reads `\(a\nb\)` as one — so, unlike the `$…$` rule, none is excluded.
    inline_math_single_backslash: /^(\\\()((?:[^\\]|\\[^)])+)\\\)/,
    display_math_single_backslash: /^(\\\[)((?:[^\\]|\\[^\]])+)\\\]/,
    // pandoc's `tex_math_double_backslash`. The closer is taken literally here,
    // with none of the escape rule above: pandoc ends the span at the first
    // `\\)` it sees, so `\\(a\\)b\\)` holds `a` rather than running on.
    inline_math_double_backslash: /^(\\\\\()((?:(?!\\\\\))[\s\S])+)\\\\\)/,
    display_math_double_backslash: /^(\\\\\[)((?:(?!\\\\\])[\s\S])+)\\\\\]/,
    // This is not the best regexp, because it not support `2^2\\^`.
    superscript: /^(\^)((?:[^^\s]|(?<=\\)\1|(?<=\\) )+?)(?<!\\)\1(?!\1)/,
    subscript: /^(~)((?:[^~\s]|(?<=\\)\1|(?<=\\) )+?)(?<!\\)\1(?!\1)/,
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    mark: /^(={2})(?=\S)([\s\S]*?\S)(\\*)\1/,
    // One pattern per valid GitLab inline-diff delimiter pair, so the opener
    // and closer can only match as a pair — JS regex has no branch-reset groups
    // to back-reference `{` to `}`. The lookahead rejects an empty or
    // whitespace-only body, so `{++}` stays literal the way `**` does.
    inline_diff: [
        /^(\{\+)(?!\s*\+\})([^\n]+?)\+\}/,
        /^(\[\+)(?!\s*\+\])([^\n]+?)\+\]/,
        /^(\{-)(?!\s*-\})([^\n]+?)-\}/,
        /^(\[-)(?!\s*-\])([^\n]+?)-\]/,
    ],
    footnote_identifier: /^(\[\^)([^^[\]\s]+)(?<!\\)\]/,
};

export type InlineExtensionRules = typeof inlineExtensionRules;

// The two backslash math extensions and the option each rule answers to. The
// double-backslash rules are listed first for intent only: the two openers are
// mutually exclusive at a given position, `\\(` carrying a backslash where `\(`
// carries the parenthesis, so neither can shadow the other.
export const BACKSLASH_MATH_RULES = [
    ['inline_math_double_backslash', 'texMathDoubleBackslash'],
    ['display_math_double_backslash', 'texMathDoubleBackslash'],
    ['inline_math_single_backslash', 'texMathSingleBackslash'],
    ['display_math_single_backslash', 'texMathSingleBackslash'],
] as const;

export const inlineRules = {
    ...endRules,
    ...commonMarkRules,
    ...gfmRules,
    ...inlineExtensionRules,
};

export type InlineRules = typeof inlineRules;

const EXCLUDE_KEYS = [
    'tail_header',
    'backlash',
    'superscript',
    'subscript',
    'footnote_identifier',
    'inline_diff',
] as const;

type InlineRuleKeys = keyof InlineRules;

type EmojiValidateRules = {
    [keys in Exclude<InlineRuleKeys, typeof EXCLUDE_KEYS[number]>]: RegExp
};

export const emojiValidateRules: EmojiValidateRules = (Object.keys(inlineRules) as InlineRuleKeys[]).reduce((acc, key) => {
    // work around with TypeScript type: https://stackoverflow.com/questions/56565528/typescript-const-assertions-how-to-use-array-prototype-includes
    if ((EXCLUDE_KEYS as ReadonlyArray<string>).includes(key)) {
        return acc;
    }
    else {
        return {
            ...acc,
            [key]: inlineRules[key],
        };
    }
}, {} as EmojiValidateRules);

export const linkValidateRules: Pick<InlineRules, 'html_tag' | 'auto_link'> = {
    html_tag: rawHtmlToken,
    auto_link: inlineRules.auto_link,
};
