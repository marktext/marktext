import type { Labels } from '../model/types';
import type { IChunkMatch, ILexContext, ILexState, IParseFrameOptions } from './frame';
import type { InlineRules } from './rules';
import type { IInlineFeatures, IInlineParseOptions } from './types';
import { isLengthEven } from '../../utils';
import { decodeCharacterReference } from '../../utils/markdownEscape';
import { tokensToPlainText } from '../projection';
import { matchExtension } from './atomicExtension';
import { matchExtendedAutoLink } from './autoLink';
import { BracketScanner } from './brackets';
import { CodeSpanScanner } from './codeSpan';
import { consumeAutoLink, consumeAutoLinkExtension, consumeBacklash, consumeBackslashMath, consumeBacktickRun, consumeBracket, consumeChunk, consumeDelimiterSpan, consumeFootnote, consumeHardLineBreak, consumeHtmlEscape, consumeHtmlTag, consumePrefix, consumeSoftLineBreak, consumeSuperSubScript, consumeTailHeader, pushPending } from './consume';
import { scanDelimiterSpans } from './delimiters';
import { resolveInlineFeatures } from './features';
import { lowerPriority } from './precedence';
import { matchPrefix } from './prefix';
import { BLOCK_PROFILES } from './profiles';
import { HtmlTagScanner } from './rawHtml';
import { BACKSLASH_MATH_RULES, emojiValidateRules, inlineRules } from './rules';
import { SourceWindow } from './sourceWindow';

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

        const to = matchExtension(rule, state.window.source, state.window.local(state.pos), state.inlineRules, state.options, state.window.offset);
        if (!to)
            continue;

        return to;
    }
    return null;
}

function matchBacklash(state: ILexState): RegExpExecArray | null {
    const backTo = state.inlineRules.backlash.exec(state.src);
    return backTo;
}

// `inline_math_gfm` goes first: both math forms open on `$`, and the dollar
// rule would otherwise swallow `` $`e=mc^2`$ `` whole, backticks and all.
// It carries its own marker shape but produces an ordinary `inline_math` token.
const CHUNK_RULES = ['inline_math_gfm', 'mark', 'inline_diff', 'emoji', 'inline_math'] as const;
function matchChunk(state: ILexState): IChunkMatch | null {
    for (const rule of CHUNK_RULES) {
        if (rule === 'mark' && !state.options.highlightSyntax)
            continue;
        const to = rule === 'mark' || rule === 'emoji'
            ? state.inlineRules[rule].exec(state.src)
            : matchExtension(rule, state.window.source, state.window.local(state.pos), state.inlineRules, state.options, state.window.offset);
        if (to && isLengthEven(to[3])) {
            if (rule === 'emoji') {
                // An emoji opener must sit at a word boundary: a ":" glued to a
                // preceding letter/digit (e.g. the colons in "12:00-14:00") is
                // not the start of a shortcode (#1677).
                const prevChar = state.window.source[state.window.local(state.pos) - 1];
                if (
                    (prevChar && /\w/.test(prevChar))
                    || !lowerPriority(state.window.source, state.window.local(state.pos) + to[0].length, emojiValidateRules, state.window.local(state.pos), state.codeSpans)
                ) {
                    return null;
                }
            }
            return { rule, to };
        }
    }

    return null;
}

function matchSuperSubScript(state: ILexState): RegExpExecArray | null {
    return matchExtension('superscript', state.window.source, state.window.local(state.pos), state.inlineRules, state.options, state.window.offset)
        ?? matchExtension('subscript', state.window.source, state.window.local(state.pos), state.inlineRules, state.options, state.window.offset);
}

function matchFootnote(state: ILexState): RegExpExecArray | null {
    return matchExtension('footnote_identifier', state.window.source, state.window.local(state.pos), state.inlineRules, state.options, state.window.offset);
}

function matchHtmlEscape(src: string, pattern: RegExp): { raw: string; content: string } | null {
    const match = src[0] === '&' ? pattern.exec(src) : null;
    if (!match)
        return null;
    const raw = match[0];
    const content = decodeCharacterReference(raw);
    return content === raw ? null : { raw, content };
}

function matchAutoLinkExtension(state: ILexState): RegExpExecArray | null {
    const autoLinkExtTo = matchExtendedAutoLink(
        state.inlineRules.auto_link_extension,
        state.window.source,
        state.window.local(state.pos),
        state.allowAutolinks,
    );
    return autoLinkExtTo;
}

function matchAutoLink(state: ILexState): RegExpExecArray | null {
    const autoLTo = state.inlineRules.auto_link.exec(state.src);
    return autoLTo;
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
            const code = state.codeSpans.read(state.window.local(state.pos))!;
            consumeBacktickRun(state, code);
            continue;
        }

        // Enabled square-bracket extensions own their markers before link consumption.
        const chunk = matchChunk(state);
        if (chunk) {
            consumeChunk(state, chunk);
            continue;
        }

        const bracket = state.context.brackets.read(state.pos, state.window.end);
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
                state.window.source,
                state.window.offset,
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

        const html = state.src[0] === '<' ? state.context.htmlTags.read(state.context.window.local(state.pos), state.context.window.local(state.window.end)) : null;
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

function parseInlineFrame(src: string, { inlineRules, pos, top, labels, options, delimiterSpans = null, allowAutolinks = top, parentContext, profile }: IParseFrameOptions) {
    const context = parentContext ?? createLexContext(src, pos, inlineRules, labels, options);
    const state: ILexState = {
        parseFrame: parseInlineFrame,
        codeSpans: context.codeSpans.view(context.window.local(pos), context.window.local(pos + src.length)),
        context,
        window: new SourceWindow(src, pos),
        src,
        pos,
        pending: '',
        pendingStartPos: pos,
        tokens: [],
        delimiterSpans,
        inlineRules,
        labels,
        options,
        top,
        allowAutolinks,
    };

    const prefix = state.pos === 0 ? matchPrefix(state.src, profile, options) : null;
    if (prefix)
        consumePrefix(state, prefix);

    consumeInlineSource(state);
    if (!parentContext)
        resolveInlineContents(context, inlineRules, labels, options);

    return state.tokens;
}

function createLexContext(source: string, offset: number, rules: InlineRules, labels: Labels, options: IInlineFeatures): ILexContext {
    const window = new SourceWindow(source, offset);
    const codeSpans = new CodeSpanScanner(source);
    const brackets = new BracketScanner(source, labels, codeSpans, { rules, options, offset });
    const htmlTags = new HtmlTagScanner(source, index => window.local(brackets.protectedEnd(window.absolute(index))));
    return { window, codeSpans, brackets, htmlTags, inlineContents: [] };
}

function resolveInlineContents(context: ILexContext, rules: InlineRules, labels: Labels, options: IInlineFeatures): void {
    for (const content of context.inlineContents) {
        content.tokens = parseInlineFrame(content.source, {
            profile: BLOCK_PROFILES.inline,
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

export function parseInline(src: string, {
    profile = 'paragraph',
    labels = new Map(),
    options,
}: IInlineParseOptions = {}) {
    const tokens = parseInlineFrame(src, {
        profile: BLOCK_PROFILES[profile],
        inlineRules,
        pos: 0,
        top: true,
        labels,
        options: resolveInlineFeatures(options),
    });

    return tokens;
}
