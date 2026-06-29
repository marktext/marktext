import type { BeginRules, InlineRules } from './rules';
import type {
    ITokenizerFacOptions,
    ITokenizerOptions,
    Labels,
    Token,
} from './types';
import { isLengthEven, union } from '../utils';
import { beginRules, inlineRules, linkValidateRules, validateRules } from './rules';
import {
    correctUrl,
    getAttributes,
    lowerPriority,
    parseSrcAndTitle,
    validateEmphasize,
} from './utils';

// const CAN_NEST_RULES = ['strong', 'em', 'link', 'del', 'a_link', 'reference_link', 'html_tag']
// disallowed html tags in https://github.github.com/gfm/#raw-html
const disallowedHtmlTag
    = /title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext/i;

// Mutable cursor + accumulator threaded through every inline-rule handler.
// `src`/`pos` advance as input is consumed; `pending`/`pendingStartPos`
// accumulate plain text between matched tokens; `tokens` collects the output.
interface ILexState {
    originSrc: string;
    src: string;
    pos: number;
    pending: string;
    pendingStartPos: number;
    tokens: Token[];
    inlineRules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    top: boolean;
    superSubScript: boolean;
    footnote: boolean;
}

function pushPending(state: ILexState) {
    if (state.pending) {
        state.tokens.push({
            type: 'text',
            parent: state.tokens,
            raw: state.pending,
            content: state.pending,
            range: {
                start: state.pendingStartPos,
                end: state.pos,
            },
        });
    }

    state.pendingStartPos = state.pos;
    state.pending = '';
}

function consumeBeginRules(state: ILexState, beginRules: BeginRules) {
    const beginRuleKeys = [
        'header',
        'hr',
        'code_fence',
        'multiple_math',
    ] as const;

    for (const ruleName of beginRuleKeys) {
        const to = beginRules[ruleName].exec(state.src);

        if (to) {
            const token = {
                type: ruleName,
                raw: to[0],
                parent: state.tokens,
                marker: to[1],
                content: to[2] || '',
                backlash: to[3] || '',
                range: {
                    start: state.pos,
                    end: state.pos + to[0].length,
                },
            };
            state.tokens.push(token);
            state.src = state.src.substring(to[0].length);
            state.pos = state.pos + to[0].length;
            break;
        }
    }
    const def = beginRules.reference_definition.exec(state.src);
    if (def && isLengthEven(def[3])) {
        const token = {
            type: 'reference_definition' as const,
            parent: state.tokens,
            leftBracket: def[1],
            label: def[2],
            backlash: def[3] || '',
            rightBracket: def[4],
            leftHrefMarker: def[5] || '',
            href: def[6],
            rightHrefMarker: def[7] || '',
            leftTitleSpace: def[8],
            titleMarker: def[9] || '',
            title: def[10] || '',
            rightTitleSpace: def[11] || '',
            raw: def[0],
            range: {
                start: state.pos,
                end: state.pos + def[0].length,
            },
        };
        state.tokens.push(token);
        state.src = state.src.substring(def[0].length);
        state.pos = state.pos + def[0].length;
    }
}

function tryBacklash(state: ILexState): boolean {
    const backTo = state.inlineRules.backlash.exec(state.src);
    if (!backTo)
        return false;

    pushPending(state);
    state.tokens.push({
        type: 'backlash',
        raw: backTo[1],
        marker: backTo[1],
        parent: state.tokens,
        content: '',
        range: {
            start: state.pos,
            end: state.pos + backTo[1].length,
        },
    });
    state.pending += state.pending + backTo[2];
    state.pendingStartPos = state.pos + backTo[1].length;
    state.src = state.src.substring(backTo[0].length);
    state.pos = state.pos + backTo[0].length;

    return true;
}

function tryStrongEm(state: ILexState): boolean {
    const emRules = ['strong', 'em'] as const;

    for (const rule of emRules) {
        const to = state.inlineRules[rule].exec(state.src);
        if (to && isLengthEven(to[3])) {
            const isValid = validateEmphasize(
                state.src,
                to[0].length,
                to[1],
                state.pending,
                validateRules,
            );
            if (isValid) {
                pushPending(state);
                const range = {
                    start: state.pos,
                    end: state.pos + to[0].length,
                };
                const marker = to[1];
                state.tokens.push({
                    type: rule,
                    raw: to[0],
                    range,
                    marker,
                    parent: state.tokens,
                    children: tokenizerFac(
                        to[2],
                        null,
                        state.inlineRules,
                        state.pos + to[1].length,
                        false,
                        state.labels,
                        state.options,
                    ),
                    backlash: to[3],
                });
                state.src = state.src.substring(to[0].length);
                state.pos = state.pos + to[0].length;

                return true;
            }

            return false;
        }
    }

    return false;
}

// emoji | inline_code | del | inline_math
function tryChunks(state: ILexState): boolean {
    const chunks = ['inline_code', 'del', 'emoji', 'inline_math'] as const;

    for (const rule of chunks) {
        const to = state.inlineRules[rule].exec(state.src);
        if (to && isLengthEven(to[3])) {
            if (rule === 'emoji') {
                // An emoji opener must sit at a word boundary: a ":" glued to a
                // preceding letter/digit (e.g. the colons in "12:00-14:00") is
                // not the start of a shortcode (#1677).
                const prevChar = state.originSrc[state.pos - 1];
                if (
                    (prevChar && /\w/.test(prevChar))
                    || !lowerPriority(state.src, to[0].length, validateRules)
                ) {
                    return false;
                }
            }
            pushPending(state);
            const range = {
                start: state.pos,
                end: state.pos + to[0].length,
            };
            const marker = to[1];
            if (
                rule === 'inline_code'
                || rule === 'emoji'
                || rule === 'inline_math'
            ) {
                state.tokens.push({
                    type: rule,
                    raw: to[0],
                    range,
                    marker,
                    parent: state.tokens,
                    content: to[2],
                    backlash: to[3],
                });
            }
            else {
                state.tokens.push({
                    type: rule,
                    raw: to[0],
                    range,
                    marker,
                    parent: state.tokens,
                    children: tokenizerFac(
                        to[2],
                        null,
                        state.inlineRules,
                        state.pos + to[1].length,
                        false,
                        state.labels,
                        state.options,
                    ),
                    backlash: to[3],
                });
            }
            state.src = state.src.substring(to[0].length);
            state.pos = state.pos + to[0].length;

            return true;
        }
    }

    return false;
}

function trySuperSubScript(state: ILexState): boolean {
    if (!state.superSubScript)
        return false;

    const superSubTo
        = state.inlineRules.superscript.exec(state.src) || state.inlineRules.subscript.exec(state.src);
    if (!superSubTo)
        return false;

    pushPending(state);
    state.tokens.push({
        type: 'super_sub_script',
        raw: superSubTo[0],
        marker: superSubTo[1],
        range: {
            start: state.pos,
            end: state.pos + superSubTo[0].length,
        },
        parent: state.tokens,
        content: superSubTo[2],
    });
    state.src = state.src.substring(superSubTo[0].length);
    state.pos = state.pos + superSubTo[0].length;

    return true;
}

function tryFootnote(state: ILexState): boolean {
    if (state.pos === 0 || !state.footnote)
        return false;

    const footnoteTo = state.inlineRules.footnote_identifier.exec(state.src);
    if (!footnoteTo)
        return false;

    pushPending(state);
    state.tokens.push({
        type: 'footnote_identifier',
        raw: footnoteTo[0],
        marker: footnoteTo[1],
        range: {
            start: state.pos,
            end: state.pos + footnoteTo[0].length,
        },
        parent: state.tokens,
        content: footnoteTo[2],
    });
    state.src = state.src.substring(footnoteTo[0].length);
    state.pos = state.pos + footnoteTo[0].length;

    return true;
}

function tryImage(state: ILexState): boolean {
    const imageTo = state.inlineRules.image.exec(state.src);
    correctUrl(imageTo);
    if (!(imageTo && isLengthEven(imageTo[3]) && isLengthEven(imageTo[5])))
        return false;

    const { src: imageSrc, title } = parseSrcAndTitle(imageTo[4]);
    pushPending(state);
    state.tokens.push({
        type: 'image',
        raw: imageTo[0],
        marker: imageTo[1],
        srcAndTitle: imageTo[4],
        // This `attrs` used for render image.
        attrs: {
            src: imageSrc + encodeURI(imageTo[5]),
            title,
            alt: imageTo[2] + encodeURI(imageTo[3]),
        },
        src: imageSrc,
        title,
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + imageTo[0].length,
        },
        alt: imageTo[2],
        backlash: {
            first: imageTo[3],
            second: imageTo[5],
        },
    });
    state.src = state.src.substring(imageTo[0].length);
    state.pos = state.pos + imageTo[0].length;

    return true;
}

function tryLink(state: ILexState): boolean {
    const linkTo = state.inlineRules.link.exec(state.src);
    correctUrl(linkTo);
    if (
        !(
            linkTo
            && isLengthEven(linkTo[3])
            && isLengthEven(linkTo[5])
            // CommonMark §6.6: code spans, HTML tags, etc. group more tightly
            // than links. If a higher-priority inline rule matches a span
            // that extends past the tentative link's range, defer to it.
            // Covers CM 0.29 examples 520 (HTML tag) and 521 (code span).
            && lowerPriority(state.src, linkTo[0].length, linkValidateRules)
        )
    ) {
        return false;
    }

    const { src: href, title } = parseSrcAndTitle(linkTo[4]);
    pushPending(state);
    state.tokens.push({
        type: 'link',
        raw: linkTo[0],
        marker: linkTo[1],
        hrefAndTitle: linkTo[4],
        href,
        title,
        parent: state.tokens,
        anchor: linkTo[2],
        range: {
            start: state.pos,
            end: state.pos + linkTo[0].length,
        },
        children: tokenizerFac(
            linkTo[2],
            null,
            state.inlineRules,
            state.pos + linkTo[1].length,
            false,
            state.labels,
            state.options,
        ),
        backlash: {
            first: linkTo[3],
            second: linkTo[5],
        },
    });

    state.src = state.src.substring(linkTo[0].length);
    state.pos = state.pos + linkTo[0].length;

    return true;
}

function tryReferenceLink(state: ILexState): boolean {
    const rLinkTo = state.inlineRules.reference_link.exec(state.src);
    if (
        !(
            rLinkTo
            // CommonMark §6.5: link labels match case-insensitively. The
            // labels Map is populated by `collectReferenceDefinitions` with
            // lowercased keys, so normalize the candidate before lookup.
            && state.labels.has((rLinkTo[3] || rLinkTo[1]).toLowerCase())
            && isLengthEven(rLinkTo[2])
            && isLengthEven(rLinkTo[4])
            && lowerPriority(state.src, rLinkTo[0].length, linkValidateRules)
        )
    ) {
        return false;
    }

    pushPending(state);
    state.tokens.push({
        type: 'reference_link',
        raw: rLinkTo[0],
        isFullLink: !!rLinkTo[3],
        parent: state.tokens,
        anchor: rLinkTo[1],
        backlash: {
            first: rLinkTo[2],
            second: rLinkTo[4] || '',
        },
        label: rLinkTo[3] || rLinkTo[1],
        range: {
            start: state.pos,
            end: state.pos + rLinkTo[0].length,
        },
        children: tokenizerFac(
            rLinkTo[1],
            null,
            state.inlineRules,
            state.pos + 1,
            false,
            state.labels,
            state.options,
        ),
    });

    state.src = state.src.substring(rLinkTo[0].length);
    state.pos = state.pos + rLinkTo[0].length;

    return true;
}

function tryReferenceImage(state: ILexState): boolean {
    const rImageTo = state.inlineRules.reference_image.exec(state.src);
    if (
        !(
            rImageTo
            && state.labels.has((rImageTo[3] || rImageTo[1]).toLowerCase())
            && isLengthEven(rImageTo[2])
            && isLengthEven(rImageTo[4])
        )
    ) {
        return false;
    }

    pushPending(state);

    state.tokens.push({
        type: 'reference_image',
        raw: rImageTo[0],
        isFullLink: !!rImageTo[3],
        parent: state.tokens,
        alt: rImageTo[1],
        backlash: {
            first: rImageTo[2],
            second: rImageTo[4] || '',
        },
        label: rImageTo[3] || rImageTo[1],
        range: {
            start: state.pos,
            end: state.pos + rImageTo[0].length,
        },
    });

    state.src = state.src.substring(rImageTo[0].length);
    state.pos = state.pos + rImageTo[0].length;

    return true;
}

function tryHtmlEscape(state: ILexState): boolean {
    const htmlEscapeTo = state.inlineRules.html_escape.exec(state.src);
    if (!htmlEscapeTo)
        return false;

    const len = htmlEscapeTo[0].length;
    pushPending(state);
    state.tokens.push({
        type: 'html_escape',
        raw: htmlEscapeTo[0],
        escapeCharacter: htmlEscapeTo[1],
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + len,
        },
    });
    state.src = state.src.substring(len);
    state.pos = state.pos + len;

    return true;
}

// GFM §6.9 (https://github.github.com/gfm/#autolinks-extension-): trim a
// www/url autolink's extent to drop characters that are not part of the link.
// The match is greedy (`\S+`), so these are applied after the regex, mirroring
// cmark-gfm's `autolink_delim`:
//   - a `<` ends the autolink;
//   - trailing punctuation `?!.,:*_~` is excluded (interior is kept);
//   - a trailing `)` is excluded when the link has more `)` than `(`, so an
//     autolink can sit inside parentheses;
//   - a trailing `;` closing an `&entity;`-looking reference is excluded.
// The last three rules interleave and are applied repeatedly (e.g. `).`).
function trimAutoLinkExtent(raw: string): string {
    let end = raw.length;

    const lt = raw.indexOf('<');
    if (lt !== -1)
        end = lt;

    let changed = true;
    while (changed && end > 0) {
        changed = false;
        const c = raw[end - 1];

        if ('?!.,:*_~'.includes(c)) {
            end -= 1;
            changed = true;
        }
        else if (c === ')') {
            let opening = 0;
            let closing = 0;
            for (let i = 0; i < end; i++) {
                if (raw[i] === '(')
                    opening += 1;
                else if (raw[i] === ')')
                    closing += 1;
            }
            if (closing > opening) {
                end -= 1;
                changed = true;
            }
        }
        else if (c === ';') {
            let entityStart = end - 2;
            while (entityStart >= 0 && /[a-z0-9]/i.test(raw[entityStart]))
                entityStart -= 1;
            if (entityStart >= 0 && entityStart < end - 2 && raw[entityStart] === '&') {
                end = entityStart;
                changed = true;
            }
        }
    }

    return raw.slice(0, end);
}

function tryAutoLinkExtension(state: ILexState): boolean {
    const autoLinkExtTo = state.inlineRules.auto_link_extension.exec(state.src);
    if (
        !(
            autoLinkExtTo
            && state.top
            && (state.pos === 0 || /[* _~(]/.test(state.originSrc[state.pos - 1]))
        )
    ) {
        return false;
    }

    let raw = autoLinkExtTo[0];
    let www = autoLinkExtTo[1];
    let url = autoLinkExtTo[2];
    const email = autoLinkExtTo[3];

    // GFM §6.9: trim characters that are not part of a www/url autolink so the
    // leftover renders as plain text instead (#2096). Email autolinks are
    // unaffected (their extent is fixed by the domain regex).
    if (!email) {
        const trimmed = trimAutoLinkExtent(raw);
        if (trimmed.length !== raw.length) {
            raw = trimmed;
            if (www)
                www = trimmed;
            if (url)
                url = trimmed;
        }
    }

    pushPending(state);
    state.tokens.push({
        type: 'auto_link_extension',
        raw,
        www,
        url,
        email,
        linkType: www ? 'www' : url ? 'url' : 'email',
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + raw.length,
        },
    });
    state.src = state.src.substring(raw.length);
    state.pos = state.pos + raw.length;

    return true;
}

function tryAutoLink(state: ILexState): boolean {
    const autoLTo = state.inlineRules.auto_link.exec(state.src);
    if (!autoLTo)
        return false;

    pushPending(state);
    state.tokens.push({
        type: 'auto_link',
        raw: autoLTo[0],
        href: autoLTo[1],
        email: autoLTo[2],
        isLink: !!autoLTo[1], // It is a link or email.
        marker: '<',
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + autoLTo[0].length,
        },
    });
    state.src = state.src.substring(autoLTo[0].length);
    state.pos = state.pos + autoLTo[0].length;

    return true;
}

// html-tag
function tryHtmlTag(state: ILexState): boolean {
    const htmlTo = state.inlineRules.html_tag.exec(state.src);
    let attrs;
    // handle comment
    if (htmlTo && htmlTo[1] && !htmlTo[3]) {
        const len = htmlTo[0].length;
        pushPending(state);
        state.tokens.push({
            type: 'html_tag',
            raw: htmlTo[0],
            tag: '<!---->',
            openTag: htmlTo[1],
            parent: state.tokens,
            attrs: {},
            range: {
                start: state.pos,
                end: state.pos + len,
            },
        });
        state.src = state.src.substring(len);
        state.pos = state.pos + len;

        return true;
    }

    if (
        htmlTo
        && !disallowedHtmlTag.test(htmlTo[3])
        // eslint-disable-next-line no-cond-assign
        && (attrs = getAttributes(htmlTo[0]))
    ) {
        const tag = htmlTo[3];
        const html = htmlTo[0];
        const len = htmlTo[0].length;

        pushPending(state);
        state.tokens.push({
            type: 'html_tag',
            raw: html,
            tag,
            openTag: htmlTo[2],
            closeTag: htmlTo[5],
            parent: state.tokens,
            attrs,
            content: htmlTo[4],
            children: htmlTo[4]
                ? tokenizerFac(
                        htmlTo[4],
                        null,
                        state.inlineRules,
                        state.pos + htmlTo[2].length,
                        false,
                        state.labels,
                        state.options,
                    )
                : [],
            range: {
                start: state.pos,
                end: state.pos + len,
            },
        });
        state.src = state.src.substring(len);
        state.pos = state.pos + len;

        return true;
    }

    return false;
}

function trySoftLineBreak(state: ILexState): boolean {
    const softTo = state.inlineRules.soft_line_break.exec(state.src);
    if (!softTo)
        return false;

    const len = softTo[0].length;
    pushPending(state);
    state.tokens.push({
        type: 'soft_line_break',
        raw: softTo[0],
        lineBreak: softTo[1],
        isAtEnd: softTo.input.length === softTo[0].length,
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + len,
        },
    });
    state.src = state.src.substring(len);
    state.pos += len;

    return true;
}

function tryHardLineBreak(state: ILexState): boolean {
    const hardTo = state.inlineRules.hard_line_break.exec(state.src);
    if (!hardTo)
        return false;

    const len = hardTo[0].length;
    pushPending(state);
    state.tokens.push({
        type: 'hard_line_break',
        raw: hardTo[0],
        spaces: hardTo[1], // The space in hard line break
        lineBreak: hardTo[2], // \n
        isAtEnd: hardTo.input.length === hardTo[0].length,
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + len,
        },
    });
    state.src = state.src.substring(len);
    state.pos += len;

    return true;
}

function tryTailHeader(state: ILexState): boolean {
    const tailTo = state.inlineRules.tail_header.exec(state.src);
    if (!(tailTo && state.top))
        return false;

    pushPending(state);
    state.tokens.push({
        type: 'tail_header',
        raw: tailTo[1],
        marker: tailTo[1],
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + tailTo[1].length,
        },
    });
    state.src = state.src.substring(tailTo[1].length);
    state.pos += tailTo[1].length;

    return true;
}

// The fixed, priority-ordered inline-rule handler list the tokenizer loop
// iterates. This array order IS the rule-precedence contract.
const INLINE_HANDLERS: ReadonlyArray<(state: ILexState) => boolean> = [
    tryBacklash,
    tryStrongEm,
    tryChunks,
    trySuperSubScript,
    tryFootnote,
    tryImage,
    tryLink,
    tryReferenceLink,
    tryReferenceImage,
    tryHtmlEscape,
    tryAutoLinkExtension,
    tryAutoLink,
    tryHtmlTag,
    trySoftLineBreak,
    tryHardLineBreak,
    tryTailHeader,
];

function tokenizerFac(src: string, beginRules: BeginRules | null, inlineRules: InlineRules, pos = 0, top: boolean, labels: Labels, options: ITokenizerFacOptions) {
    const { superSubScript, footnote } = options;
    const state: ILexState = {
        originSrc: src,
        src,
        pos,
        pending: '',
        pendingStartPos: pos,
        tokens: [],
        inlineRules,
        labels,
        options,
        top,
        superSubScript,
        footnote,
    };

    if (beginRules && state.pos === 0)
        consumeBeginRules(state, beginRules);

    while (state.src.length) {
        let consumed = false;
        for (const handler of INLINE_HANDLERS) {
            if (handler(state)) {
                consumed = true;
                break;
            }
        }
        if (consumed)
            continue;

        if (!state.pending)
            state.pendingStartPos = state.pos;
        state.pending += state.src[0];
        state.src = state.src.substring(1);
        state.pos++;
    }

    pushPending(state);

    return state.tokens;
}

export function tokenizer(src: string, {
    highlights = [],
    hasBeginRules = true,
    labels = new Map(),
    options = {
        superSubScript: true,
        footnote: false,
    },
}: ITokenizerOptions = {} as ITokenizerOptions) {
    const tokens = tokenizerFac(
        src,
        hasBeginRules ? beginRules : null,
        inlineRules,
        0,
        true,
        labels,
        options,
    );

    const postTokenizer = (tokens: Token[]) => {
        for (const token of tokens) {
            for (const light of highlights) {
                const highlight = union(token.range, light);
                if (highlight) {
                    if (token.highlights && Array.isArray(token.highlights))
                        token.highlights.push(highlight);
                    else
                        token.highlights = [highlight];
                }
            }

            if ('children' in token && token.children && Array.isArray(token.children))
                postTokenizer(token.children);
        }
    };

    if (highlights.length)
        postTokenizer(tokens);

    return tokens;
}

// transform `tokens` to text ignore the range of token
// the opposite of tokenizer
// Rebuild a marker-wrapped token from its children instead of its stale cached
// `raw` (#2063). Link/image keep their stored raw.
function rebuildWrapperToken(token: Token): string {
    switch (token.type) {
        case 'strong':
        case 'em':
        case 'del':
            return token.marker + generator(token.children, true) + token.marker;

        case 'html_tag':
            if (token.openTag != null && token.closeTag != null && token.children != null)
                return token.openTag + generator(token.children, true) + token.closeTag;

            return token.raw;

        default:
            return token.raw;
    }
}

// `rebuildWrappers` is opt-in: only `format()` mutates a wrapper's children;
// `backspaceHandler` trims a marker off `raw` and needs it echoed verbatim.
export function generator(tokens: Token[], rebuildWrappers = false) {
    let result = '';

    for (const token of tokens)
        result += rebuildWrappers ? rebuildWrapperToken(token) : token.raw;

    return result;
}
