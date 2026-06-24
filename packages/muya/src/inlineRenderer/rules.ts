import { escapeCharacters } from '../config/escapeCharacter';

export const beginRules = {
    hr: /^(\*{3,}|-{3,}|_{3,})$/,
    code_fence: /^(`{3,})([^`]*)$/,
    header: /(^ {0,3}#{1,6}(\s+|$))/,
    reference_definition:
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/no-misleading-capturing-group
    /^( {0,3}\[)([^\]]+?)(\\*)(\]: *)(<?)([^\s>]+)(>?)(?:( +)(["'(]?)([^\n"'()]+)\9)?( *)$/,

    // extra syntax (not belongs to GFM)
    multiple_math: /^(\$\$)$/,
};

export const endRules = {
    tail_header: /^(\s+#+)(\s*)$/,
};

export type BeginRules = typeof beginRules;

export const commonMarkRules = {
    strong: /^(\*\*|__)(?=\S)([\s\S]*?[^\s\\])(\\*)\1(?!(\*|_))/, // can nest
    em: /^(\*|_)(?=\S)([\s\S]*?[^\s*\\])(\\*)\1(?!\1)/, // can nest
    // Hand-tuned CommonMark/GFM patterns. Disabling the ReDoS-class regexp/*
    // rules here on each line they fire: rewriting these patterns to please
    // the linter would risk parser regressions, and the input is the user's
    // own document, not untrusted network data.
    // eslint-disable-next-line regexp/no-misleading-capturing-group
    inline_code: /^(`{1,3})([^`]+|.{2,})\1/,
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/optimal-quantifier-concatenation, regexp/no-misleading-capturing-group
    image: /^(!\[)(.*?)(\\*)\]\((.*)(\\*)\)/,
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/optimal-quantifier-concatenation, regexp/no-misleading-capturing-group
    link: /^(\[)((?:\[[^\]]*\]|[^[\]]|\](?=[^[]*\]))*?)(\\*)\]\((.*)(\\*)\)/, // can nest
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    reference_link: /^\[([^\]]+?)(\\*)\](?:\[([^\]]*?)(\\*)\])?/,
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    reference_image: /^!\[([^\]]+?)(\\*)\](?:\[([^\]]*?)(\\*)\])?/,
    html_tag:
    // eslint-disable-next-line regexp/no-super-linear-backtracking, regexp/optimal-quantifier-concatenation
    /^(<!--[\s\S]*?-->|(<([a-z][a-z\d-]*)[^\n<>]*>)(?:([\s\S]*?)(<\/\3 *>))?)/i, // raw html
    html_escape: new RegExp(`^(${escapeCharacters.join('|')})`, 'i'),
    soft_line_break: /^(\n)(?!\n)/,
    hard_line_break: /^( {2,})(\n)(?!\n)/,

    // patched math marker `$`
    backlash: /^(\\)([\\`*{}[\]()#+\-.!_>~:|<$])/,
};

export type CommonMarkRules = typeof commonMarkRules;

export const gfmRules = {
    emoji: /^(:)([a-z_\d+-]+)\1/,
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    del: /^(~{2})(?=\S)([\s\S]*?\S)(\\*)\1/, // can nest
    auto_link:
    /^<(?:([a-z][a-z\d+.\-]{1,31}:[^ <>]*)|([\w.!#$%&'*+/=?^`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*))>/i,
    // (extended www autolink|extended url autolink|extended email autolink) the email regexp is the same as auto_link.
    auto_link_extension:
    /^(?:(www\.[a-z_-]+\.[a-z]{2,}(?::\d{1,5})?(?:\/\S+)?)|(https?:\/\/(?:[a-z0-9\-._~]+\.[a-z]{2,}|[0-9.]+|localhost|\[[a-f0-9.:]+\])(?::\d{1,5})?(?:\/\S+)?)|([\w.!#$%&'*+/=?^`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*))(?=\s|$)/,
};

export type GfmRules = typeof gfmRules;

// Markdown extensions (not belongs to GFM and Commonmark)
export const inlineExtensionRules = {
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    inline_math: /^(\$)((?:[^$\\]|\\.)+)(\\*)\1(?!\1)/,
    // This is not the best regexp, because it not support `2^2\\^`.
    superscript: /^(\^)((?:[^^\s]|(?<=\\)\1|(?<=\\) )+?)(?<!\\)\1(?!\1)/,
    subscript: /^(~)((?:[^~\s]|(?<=\\)\1|(?<=\\) )+?)(?<!\\)\1(?!\1)/,
    footnote_identifier: /^(\[\^)([^^[\]\s]+)(?<!\\)\]/,
};

export type InlineExtensionRules = typeof inlineExtensionRules;

export const inlineRules = {
    ...endRules,
    ...commonMarkRules,
    ...gfmRules,
    ...inlineExtensionRules,
};

export type InlineRules = typeof inlineRules;

const EXCLUDE_KEYS = [
    'em',
    'strong',
    'tail_header',
    'backlash',
    'superscript',
    'subscript',
    'footnote_identifier',
] as const;

type InlineRuleKeys = keyof InlineRules;

type ValidateRules = {
    [keys in Exclude<InlineRuleKeys, typeof EXCLUDE_KEYS[number]>]: RegExp
};

export const validateRules: ValidateRules = (Object.keys(inlineRules) as InlineRuleKeys[]).reduce((acc, key) => {
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
}, {} as ValidateRules);

// Veto set used when validating a tentative `[text](url)` / reference link.
// Per CommonMark §6.6 only code spans, raw HTML tags and `<...>` autolinks bind
// more tightly than a link, so only those may defer a link that overlaps them
// (CM 0.29 examples 520/521). Using the full `validateRules` here is wrong: a
// GFM extended (bare-URL) autolink or the link rule's own greedy destination
// match would extend past the tentative link and veto it, dropping links such
// as `[t](https://x)、` or `[t](https://x)foo` and the first of two links on a
// line (#4671).
export const linkValidateRules: Pick<InlineRules, 'inline_code' | 'html_tag' | 'auto_link'> = {
    inline_code: inlineRules.inline_code,
    html_tag: inlineRules.html_tag,
    auto_link: inlineRules.auto_link,
};
