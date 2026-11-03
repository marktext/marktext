import type { IDelimiterSpan } from '../utils/delimiters';
import type { ImageMatch, LinkMatch } from './brackets';
import type { ICodeSpanMatch, ICodeSpanReader } from './codeSpan';
import type { BeginRules, InlineRules } from './rules';
import type {
    HTMLTagToken,
    ImageToken,
    ITokenizerFacOptions,
    ITokenizerOptions,
    Labels,
    ReferenceImageToken,
    Token,
} from './types';
import { isLengthEven } from '../utils';
import { decodeCharacterReference } from '../utils/markdownEscape';
import { BracketScanner } from './brackets';
import { codeSpanContent, CodeSpanScanner } from './codeSpan';
import { scanDelimiterSpans } from './delimiters';
import { tokensToPlainText } from './projection';
import { HtmlTagScanner } from './rawHtml';
import { parseReferenceDefinition } from './referenceDefinitions';
import { BACKSLASH_MATH_RULES, beginRules, emojiValidateRules, inlineRules } from './rules';
import { applySearchHighlights } from './searchHighlights';
import {
    getAttributes,
    lowerPriority,
    matchExtendedAutoLink,
} from './utils';

export { tokensToInlineHtml, tokensToPlainText } from './projection';
export { generator } from './serialization';

interface IInlineContent {
    source: string;
    position: number;
    token: ImageToken | ReferenceImageToken | HTMLTagToken;
    tokens: Token[];
}

interface ILexContext {
    offset: number;
    codeSpans: CodeSpanScanner;
    brackets: BracketScanner;
    htmlTags: HtmlTagScanner;
    // One root-owned queue keeps unbounded HTML/image nesting off the JS call stack.
    inlineContents: IInlineContent[];
}

// Mutable cursor + accumulator threaded through every inline-rule handler.
// `src`/`pos` advance as input is consumed; `pending`/`pendingStartPos`
// accumulate plain text between matched tokens; `tokens` collects the output.
interface ILexState {
    codeSpans: ICodeSpanReader;
    context: ILexContext;
    originSrc: string;
    src: string;
    pos: number;
    pending: string;
    pendingStartPos: number;
    tokens: Token[];
    delimiterSpans: Map<number, IDelimiterSpan> | null;
    basePos: number;
    inlineRules: InlineRules;
    labels: Labels;
    options: ITokenizerFacOptions;
    top: boolean;
    allowAutolinks: boolean;
}

function pushPending(state: ILexState) {
    if (state.pending) {
        let contentEnd = state.pending.length;
        if (state.top && state.src.length === 0) {
            while (contentEnd > 0 && /[ \t]/.test(state.pending[contentEnd - 1]))
                contentEnd--;
        }
        state.tokens.push({
            type: 'text',
            parent: state.tokens,
            raw: state.pending,
            content: state.pending.slice(0, contentEnd),
            range: {
                start: state.pendingStartPos,
                end: state.pos,
            },
        });
    }

    state.pendingStartPos = state.pos;
    state.pending = '';
}

// The `code_fence` rule alternates between a backtick and a tilde fence, so its
// marker and info string land in the second alternative's capture slots; every
// other begin rule keeps its original single-alternative shape.
function beginRuleParts(ruleName: string, to: RegExpExecArray) {
    if (ruleName !== 'code_fence')
        return { marker: to[1], content: to[2] || '', backlash: to[3] || '' };

    return { marker: to[1] || to[3], content: to[2] || to[4] || '', backlash: '' };
}

function consumeBeginRules(state: ILexState, beginRules: BeginRules) {
    const beginRuleKeys = [
        'header',
        'hr',
        'code_fence',
        'multiple_math',
    ] as const;

    for (const ruleName of beginRuleKeys) {
        if (ruleName === 'multiple_math' && !state.options.texMathDollars)
            continue;

        const to = beginRules[ruleName].exec(state.src);

        if (to) {
            const { marker, content, backlash } = beginRuleParts(ruleName, to);
            const token = {
                type: ruleName,
                raw: to[0],
                parent: state.tokens,
                marker,
                content,
                backlash,
                range: {
                    start: state.pos,
                    end: state.pos + to[0].length,
                },
            };
            state.tokens.push(token);
            state.src = state.src.substring(to[0].length);
            state.pos = state.pos + to[0].length;
            return;
        }
    }
    const definition = parseReferenceDefinition(state.src);
    if (definition && isLengthEven(definition.backlash)) {
        state.tokens.push({
            ...definition,
            type: 'reference_definition',
            parent: state.tokens,
            range: { start: state.pos, end: state.pos + definition.raw.length },
        });
        state.src = state.src.substring(definition.raw.length);
        state.pos += definition.raw.length;
    }
}

// pandoc's `tex_math_single_backslash` and `tex_math_double_backslash`. These
// run ahead of escape consumption because `commonMarkRules.backlash` lists `(` and
// `[` among the punctuation a backslash escapes, so it would consume the opener
// before any math rule saw it — the collision the pandoc manual calls out as
// the extension's drawback. With both options off the handler declines and the
// escape keeps the span.
function matchBackslashMath(state: ILexState): RegExpExecArray | null {
    if (!state.options.texMathSingleBackslash && !state.options.texMathDoubleBackslash)
        return null;

    for (const [rule, option] of BACKSLASH_MATH_RULES) {
        if (!state.options[option])
            continue;

        const to = state.inlineRules[rule].exec(state.src);
        if (!to)
            continue;

        return to;
    }
    return null;
}

function consumeBackslashMath(state: ILexState, to: RegExpExecArray): void {
    pushPending(state);
    // All math delimiters share rendering semantics; marker retains their source spelling.
    state.tokens.push({
        type: 'inline_math',
        raw: to[0],
        range: {
            start: state.pos,
            end: state.pos + to[0].length,
        },
        marker: to[1],
        parent: state.tokens,
        content: to[2],
        backlash: to[3],
    });
    state.src = state.src.substring(to[0].length);
    state.pos = state.pos + to[0].length;
}

function matchBacklash(state: ILexState): RegExpExecArray | null {
    const backTo = state.inlineRules.backlash.exec(state.src);
    return backTo;
}

function consumeBacklash(state: ILexState, backTo: RegExpExecArray): void {
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
}

function consumeDelimiterSpan(state: ILexState, span: IDelimiterSpan): void {
    const length = span.end - span.start;
    const raw = state.src.substring(0, length);
    const marker = raw.substring(0, span.markerLength);
    const inner = raw.substring(span.markerLength, length - span.markerLength);
    const backlash = /(\\*)$/.exec(inner)![1];
    const content = inner.substring(0, inner.length - backlash.length);

    pushPending(state);
    state.tokens.push({
        type: raw[0] === '~' ? 'del' : span.markerLength === 2 ? 'strong' : 'em',
        raw,
        range: {
            start: state.pos,
            end: state.pos + length,
        },
        marker,
        parent: state.tokens,
        children: parseInlineFrame(content, {
            beginRules: null,
            inlineRules: state.inlineRules,
            pos: state.pos + span.markerLength,
            top: false,
            labels: state.labels,
            options: state.options,
            delimiterSpans: state.delimiterSpans,
            allowAutolinks: state.allowAutolinks,
            parentContext: state.context,
        }),
        backlash,
    });
    state.src = state.src.substring(length);
    state.pos = state.pos + length;
}

// `inline_math_gfm` goes first: both math forms open on `$`, and the dollar
// rule would otherwise swallow `` $`e=mc^2`$ `` whole, backticks and all.
// It carries its own marker shape but produces an ordinary `inline_math` token.
const CHUNK_RULES = ['inline_math_gfm', 'mark', 'inline_diff', 'emoji', 'inline_math'] as const;
interface IChunkMatch {
    rule: typeof CHUNK_RULES[number];
    to: RegExpExecArray;
}

function matchChunk(state: ILexState): IChunkMatch | null {
    for (const rule of CHUNK_RULES) {
        if (rule === 'inline_math' && !state.options.texMathDollars)
            continue;
        if (rule === 'inline_math_gfm' && !state.options.texMathGfm)
            continue;
        if (rule === 'mark' && !state.options.highlightSyntax)
            continue;
        if (rule === 'inline_diff' && !state.options.inlineDiff)
            continue;

        const ruleValue = state.inlineRules[rule];
        const to = Array.isArray(ruleValue)
            ? ruleValue.map(rule => rule.exec(state.src)).find(Boolean)
            : ruleValue.exec(state.src);
        if (to && isLengthEven(to[3])) {
            if (rule === 'emoji') {
                // An emoji opener must sit at a word boundary: a ":" glued to a
                // preceding letter/digit (e.g. the colons in "12:00-14:00") is
                // not the start of a shortcode (#1677).
                const prevChar = state.originSrc[state.pos - 1];
                if (
                    (prevChar && /\w/.test(prevChar))
                    || !lowerPriority(state.originSrc, state.pos - state.basePos + to[0].length, emojiValidateRules, state.pos - state.basePos, state.codeSpans)
                ) {
                    return null;
                }
            }
            return { rule, to };
        }
    }

    return null;
}

function consumeChunk(state: ILexState, { rule, to }: IChunkMatch): void {
    pushPending(state);
    const range = {
        start: state.pos,
        end: state.pos + to[0].length,
    };
    const marker = to[1];
    if (rule === 'mark') {
        state.tokens.push({
            type: rule,
            raw: to[0],
            range,
            marker,
            parent: state.tokens,
            children: parseInlineFrame(to[2], {
                beginRules: null,
                inlineRules: state.inlineRules,
                pos: state.pos + to[1].length,
                top: false,
                labels: state.labels,
                options: state.options,
                delimiterSpans: null,
                allowAutolinks: state.allowAutolinks,
                parentContext: state.context,
            }),
            backlash: to[3],
        });
    }
    else {
        state.tokens.push({
            type: rule === 'inline_math_gfm' ? 'inline_math' : rule,
            raw: to[0],
            range,
            marker,
            parent: state.tokens,
            content: to[2],
            backlash: to[3],
        });
    }
    state.src = state.src.substring(to[0].length);
    state.pos = state.pos + to[0].length;
}

function matchSuperSubScript(state: ILexState): RegExpExecArray | null {
    if (!state.options.superSubScript)
        return null;

    const superSubTo
        = state.inlineRules.superscript.exec(state.src) || state.inlineRules.subscript.exec(state.src);
    return superSubTo;
}

function consumeSuperSubScript(state: ILexState, superSubTo: RegExpExecArray): void {
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
}

function matchFootnote(state: ILexState): RegExpExecArray | null {
    if (state.pos === 0 || !state.options.footnote)
        return null;

    const footnoteTo = state.inlineRules.footnote_identifier.exec(state.src);
    return footnoteTo;
}

function consumeFootnote(state: ILexState, footnoteTo: RegExpExecArray): void {
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
}

function consumeImage(state: ILexState, match: ImageMatch): void {
    const common = {
        raw: match.raw,
        alt: match.alt,
        backlash: match.backlash,
        parent: state.tokens,
        range: { start: state.pos, end: state.pos + match.raw.length },
    };
    pushPending(state);
    let token: ImageToken | ReferenceImageToken;
    if (match.type === 'image') {
        const { src, title } = match.tail;
        token = {
            ...common,
            type: 'image',
            marker: '![',
            srcAndTitle: match.srcAndTitle,
            attrs: { src, title, alt: '' },
            src,
            title,
        };
    }
    else {
        token = {
            ...common,
            type: 'reference_image',
            attrs: { alt: '' },
            label: match.label,
            isFullLink: match.isFullLink,
        };
    }
    state.tokens.push(token);
    state.context.inlineContents.push({ source: match.description, position: state.pos + 2, token, tokens: [] });
    state.src = state.src.substring(match.raw.length);
    state.pos += match.raw.length;
}

function consumeLink(state: ILexState, match: LinkMatch): void {
    const common = {
        raw: match.raw,
        parent: state.tokens,
        anchor: match.description,
        range: { start: state.pos, end: state.pos + match.raw.length },
        children: parseInlineFrame(match.description, {
            beginRules: null,
            inlineRules: state.inlineRules,
            pos: state.pos + 1,
            top: false,
            labels: state.labels,
            options: state.options,
            delimiterSpans: null,
            allowAutolinks: false,
            parentContext: state.context,
        }),
        backlash: { first: '', second: '' },
    };
    pushPending(state);
    if (match.type === 'link') {
        state.tokens.push({
            ...common,
            type: 'link',
            marker: '[',
            hrefAndTitle: match.srcAndTitle + match.backlash.second,
            href: match.tail.src,
            title: match.tail.title,
        });
    }
    else {
        state.tokens.push({
            ...common,
            type: 'reference_link',
            label: match.label,
            isFullLink: match.isFullLink,
        });
    }
    state.src = state.src.substring(match.raw.length);
    state.pos += match.raw.length;
}

function consumeBracket(state: ILexState, match: ImageMatch | LinkMatch): void {
    if (match.type === 'image' || match.type === 'reference_image')
        consumeImage(state, match);
    else
        consumeLink(state, match);
}

function matchHtmlEscape(src: string, pattern: RegExp): { raw: string; content: string } | null {
    const match = src[0] === '&' ? pattern.exec(src) : null;
    if (!match)
        return null;
    const raw = match[0];
    const content = decodeCharacterReference(raw);
    return content === raw ? null : { raw, content };
}

function consumeHtmlEscape(state: ILexState, raw: string, content: string): void {
    const len = raw.length;
    pushPending(state);
    state.tokens.push({
        type: 'html_escape',
        raw,
        escapeCharacter: raw,
        content,
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + len,
        },
    });
    state.src = state.src.substring(len);
    state.pos = state.pos + len;
}

function matchAutoLinkExtension(state: ILexState): RegExpExecArray | null {
    const autoLinkExtTo = matchExtendedAutoLink(
        state.inlineRules.auto_link_extension,
        state.originSrc,
        state.pos - state.basePos,
        state.allowAutolinks,
    );
    return autoLinkExtTo;
}

function consumeAutoLinkExtension(state: ILexState, autoLinkExtTo: RegExpExecArray): void {
    const [raw, www, url, email] = autoLinkExtTo;

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
}

function matchAutoLink(state: ILexState): RegExpExecArray | null {
    const autoLTo = state.inlineRules.auto_link.exec(state.src);
    return autoLTo;
}

function consumeAutoLink(state: ILexState, autoLTo: RegExpExecArray): void {
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
}

function consumeHtmlTag(state: ILexState, html: NonNullable<ReturnType<HtmlTagScanner['read']>>): void {
    pushPending(state);
    const token: HTMLTagToken = {
        type: 'html_tag',
        ...html,
        parent: state.tokens,
        attrs: html.kind === 'tag' ? getAttributes(html.openTag) : {},
        children: [],
        range: { start: state.pos, end: state.pos + html.raw.length },
    };
    state.tokens.push(token);
    if (html.content)
        state.context.inlineContents.push({ source: html.content, position: state.pos + html.openTag.length, token, tokens: [] });
    state.src = state.src.substring(html.raw.length);
    state.pos += html.raw.length;
}

function consumeSoftLineBreak(state: ILexState, softTo: RegExpExecArray): void {
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
}

function consumeHardLineBreak(state: ILexState, hardTo: RegExpExecArray): void {
    const len = hardTo[0].length;
    pushPending(state);
    state.tokens.push({
        type: 'hard_line_break',
        raw: hardTo[0],
        marker: hardTo[1],
        lineBreak: hardTo[2],
        leadingSpaces: hardTo[3],
        isAtEnd: hardTo.input.length === hardTo[0].length,
        parent: state.tokens,
        range: {
            start: state.pos,
            end: state.pos + len,
        },
    });
    state.src = state.src.substring(len);
    state.pos += len;
}

function matchTailHeader(state: ILexState): RegExpExecArray | null {
    if (!state.top || state.tokens[0]?.type !== 'header')
        return null;

    // For an empty ATX body, the opening token already consumed the separator.
    const afterOpening = state.tokens.length === 1 && !state.pending;
    const tailTo = state.inlineRules.tail_header.exec(state.src)
        ?? (afterOpening ? /^(#+)(\s*)$/.exec(state.src) : null);
    return tailTo;
}

function consumeTailHeader(state: ILexState, tailTo: RegExpExecArray): void {
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
}

function consumeBacktickRun(state: ILexState, match: ICodeSpanMatch): void {
    if (!match.closed) {
        // Retrying inside an unmatched run would invent a shorter opener.
        if (!state.pending)
            state.pendingStartPos = state.pos;
        state.pending += state.src.slice(0, match.markerLength);
        state.src = state.src.substring(match.markerLength);
        state.pos += match.markerLength;
        return;
    }
    const length = match.end - (state.pos - state.basePos);
    const raw = state.src.slice(0, length);
    const { markerLength } = match;
    const { content, leading, trailing } = codeSpanContent(raw.slice(markerLength, -markerLength));

    pushPending(state);
    state.tokens.push({
        type: 'inline_code',
        raw,
        marker: raw.slice(0, markerLength),
        content,
        contentRange: { start: state.pos + markerLength + leading, end: state.pos + length - markerLength - trailing },
        backlash: '',
        parent: state.tokens,
        range: { start: state.pos, end: state.pos + length },
    });
    state.pos += length;
    state.src = state.src.substring(length);
}

interface IRegexRule {
    match: (state: ILexState) => RegExpExecArray | null;
    consume: (state: ILexState, match: RegExpExecArray) => void;
}

function matchRegexRule(state: ILexState, rules: readonly IRegexRule[]) {
    for (const rule of rules) {
        const match = rule.match(state);
        if (match)
            return { match, consume: rule.consume };
    }
    return null;
}

const ESCAPE_RULES: readonly IRegexRule[] = [
    { match: matchBackslashMath, consume: consumeBackslashMath },
    { match: matchBacklash, consume: consumeBacklash },
];

const INLINE_RULES: readonly IRegexRule[] = [
    { match: matchSuperSubScript, consume: consumeSuperSubScript },
    { match: matchFootnote, consume: consumeFootnote },
    { match: matchAutoLinkExtension, consume: consumeAutoLinkExtension },
    { match: matchAutoLink, consume: consumeAutoLink },
    { match: matchTailHeader, consume: consumeTailHeader },
];

function consumeInlineSource(state: ILexState): void {
    while (state.src.length) {
        if (state.src[0] === '`') {
            const code = state.codeSpans.read(state.pos - state.basePos)!;
            consumeBacktickRun(state, code);
            continue;
        }

        // Enabled square-bracket extensions own their markers before link consumption.
        const chunk = matchChunk(state);
        if (chunk) {
            consumeChunk(state, chunk);
            continue;
        }

        const bracket = state.context.brackets.read(state.pos, state.basePos + state.originSrc.length);
        if (bracket) {
            consumeBracket(state, bracket);
            continue;
        }

        const reference = matchHtmlEscape(state.src, state.inlineRules.html_escape);
        if (reference) {
            consumeHtmlEscape(state, reference.raw, reference.content);
            continue;
        }

        const escape = matchRegexRule(state, ESCAPE_RULES);
        if (escape) {
            escape.consume(state, escape.match);
            continue;
        }

        if (state.src[0] === '*' || state.src[0] === '_' || state.src[0] === '~') {
            state.delimiterSpans ??= scanDelimiterSpans(
                state.originSrc,
                state.basePos,
                state.inlineRules,
                state.labels,
                state.options,
                state.allowAutolinks,
                state.codeSpans,
                state.context.brackets,
            );
            const span = state.delimiterSpans.get(state.pos);
            if (span) {
                consumeDelimiterSpan(state, span);
                continue;
            }
        }

        const inline = matchRegexRule(state, INLINE_RULES);
        if (inline) {
            inline.consume(state, inline.match);
            continue;
        }

        const html = state.src[0] === '<' ? state.context.htmlTags.read(state.pos - state.context.offset, state.basePos + state.originSrc.length - state.context.offset) : null;
        if (html) {
            consumeHtmlTag(state, html);
            continue;
        }

        const hardBreak = state.inlineRules.hard_line_break.exec(state.src);
        if (hardBreak) {
            consumeHardLineBreak(state, hardBreak);
            continue;
        }

        const softBreak = state.inlineRules.soft_line_break.exec(state.src);
        if (softBreak) {
            consumeSoftLineBreak(state, softBreak);
            continue;
        }

        if (!state.pending)
            state.pendingStartPos = state.pos;
        state.pending += state.src[0];
        state.src = state.src.substring(1);
        state.pos++;
    }

    pushPending(state);
}

interface IParseFrameOptions {
    beginRules: BeginRules | null;
    inlineRules: InlineRules;
    pos: number;
    top: boolean;
    labels: Labels;
    options: ITokenizerFacOptions;
    delimiterSpans?: Map<number, IDelimiterSpan> | null;
    allowAutolinks?: boolean;
    parentContext?: ILexContext;
}

function parseInlineFrame(src: string, { beginRules, inlineRules, pos, top, labels, options, delimiterSpans = null, allowAutolinks = top, parentContext }: IParseFrameOptions) {
    const context = parentContext ?? createLexContext(src, pos, inlineRules, labels, options);
    const state: ILexState = {
        codeSpans: context.codeSpans.view(pos - context.offset, pos + src.length - context.offset),
        context,
        originSrc: src,
        src,
        pos,
        pending: '',
        pendingStartPos: pos,
        tokens: [],
        delimiterSpans,
        basePos: pos,
        inlineRules,
        labels,
        options,
        top,
        allowAutolinks,
    };

    if (beginRules && state.pos === 0)
        consumeBeginRules(state, beginRules);

    consumeInlineSource(state);
    if (!parentContext)
        resolveInlineContents(context, inlineRules, labels, options);

    return state.tokens;
}

function createLexContext(source: string, offset: number, rules: InlineRules, labels: Labels, options: ITokenizerFacOptions): ILexContext {
    const codeSpans = new CodeSpanScanner(source);
    const brackets = new BracketScanner(source, labels, codeSpans, { rules, options, offset });
    const htmlTags = new HtmlTagScanner(source, index => brackets.protectedEnd(index + offset) - offset);
    return { offset, codeSpans, brackets, htmlTags, inlineContents: [] };
}

function resolveInlineContents(context: ILexContext, rules: InlineRules, labels: Labels, options: ITokenizerFacOptions): void {
    for (const content of context.inlineContents) {
        content.tokens = parseInlineFrame(content.source, {
            beginRules: null,
            inlineRules: rules,
            pos: content.position,
            top: false,
            labels,
            options,
            delimiterSpans: null,
            allowAutolinks: false,
            parentContext: context,
        });
        if (content.token.type === 'html_tag')
            content.token.children = content.tokens;
    }
    for (let i = context.inlineContents.length - 1; i >= 0; i--) {
        const { token, tokens } = context.inlineContents[i];
        if (token.type !== 'html_tag')
            token.attrs.alt = tokensToPlainText(tokens, '\n');
    }
}

export function tokenizer(src: string, {
    highlights = [],
    hasBeginRules = true,
    labels = new Map(),
    options = {
        superSubScript: true,
        footnote: false,
        texMathDollars: true,
        texMathGfm: false,
        texMathSingleBackslash: false,
        texMathDoubleBackslash: false,
        highlightSyntax: false,
        inlineDiff: false,
    },
}: ITokenizerOptions = {} as ITokenizerOptions) {
    const tokens = parseInlineFrame(src, {
        beginRules: hasBeginRules ? beginRules : null,
        inlineRules,
        pos: 0,
        top: true,
        labels,
        options,
    });

    applySearchHighlights(tokens, highlights);

    return tokens;
}
