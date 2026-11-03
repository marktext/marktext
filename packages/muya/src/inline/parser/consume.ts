import type { IDelimiterSpan } from '../../utils/delimiters';
import type { HTMLTagToken, ImageToken, ReferenceImageToken } from '../model/types';
import type { ImageMatch, LinkMatch } from './brackets';
import type { ICodeSpanMatch } from './codeSpan';
import type { IChunkMatch, ILexState } from './frame';
import type { PrefixMatch } from './prefix';
import type { HtmlTagScanner } from './rawHtml';
import { codeSpanContent } from './codeSpan';
import { getAttributes } from './htmlAttributes';
import { BLOCK_PROFILES } from './profiles';

export function pushPending(state: ILexState) {
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

export function consumePrefix(state: ILexState, match: PrefixMatch): void {
    state.tokens.push({
        ...match,
        parent: state.tokens,
        range: { start: state.pos, end: state.pos + match.raw.length },
    });
    state.src = state.src.substring(match.raw.length);
    state.pos += match.raw.length;
}

export function consumeBackslashMath(state: ILexState, to: RegExpExecArray): void {
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

export function consumeBacklash(state: ILexState, backTo: RegExpExecArray): void {
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
    state.pending += backTo[2];
    state.pendingStartPos = state.pos + backTo[1].length;
    state.src = state.src.substring(backTo[0].length);
    state.pos = state.pos + backTo[0].length;
}

export function consumeDelimiterSpan(state: ILexState, span: IDelimiterSpan): void {
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
        children: state.parseFrame(content, {
            profile: BLOCK_PROFILES.inline,
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

export function consumeChunk(state: ILexState, { rule, to }: IChunkMatch): void {
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
            children: state.parseFrame(to[2], {
                profile: BLOCK_PROFILES.inline,
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

export function consumeSuperSubScript(state: ILexState, superSubTo: RegExpExecArray): void {
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

export function consumeFootnote(state: ILexState, footnoteTo: RegExpExecArray): void {
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

export function consumeImage(state: ILexState, match: ImageMatch): void {
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

export function consumeLink(state: ILexState, match: LinkMatch): void {
    const common = {
        raw: match.raw,
        parent: state.tokens,
        anchor: match.description,
        range: { start: state.pos, end: state.pos + match.raw.length },
        children: state.parseFrame(match.description, {
            profile: BLOCK_PROFILES.inline,
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

export function consumeBracket(state: ILexState, match: ImageMatch | LinkMatch): void {
    if (match.type === 'image' || match.type === 'reference_image')
        consumeImage(state, match);
    else
        consumeLink(state, match);
}

export function consumeHtmlEscape(state: ILexState, raw: string, content: string): void {
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

export function consumeAutoLinkExtension(state: ILexState, autoLinkExtTo: RegExpExecArray): void {
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

export function consumeAutoLink(state: ILexState, autoLTo: RegExpExecArray): void {
    pushPending(state);
    state.tokens.push({
        type: 'auto_link',
        raw: autoLTo[0],
        href: autoLTo[1],
        email: autoLTo[2],
        isLink: !!autoLTo[1],
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

export function consumeHtmlTag(state: ILexState, html: NonNullable<ReturnType<HtmlTagScanner['read']>>): void {
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

export function consumeSoftLineBreak(state: ILexState, softTo: RegExpExecArray): void {
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

export function consumeHardLineBreak(state: ILexState, hardTo: RegExpExecArray): void {
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

export function consumeTailHeader(state: ILexState, tailTo: RegExpExecArray): void {
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

export function consumeBacktickRun(state: ILexState, match: ICodeSpanMatch): void {
    if (!match.closed) {
        // Retrying inside an unmatched run would invent a shorter opener.
        if (!state.pending)
            state.pendingStartPos = state.pos;
        state.pending += state.src.slice(0, match.markerLength);
        state.src = state.src.substring(match.markerLength);
        state.pos += match.markerLength;
        return;
    }
    const length = match.end - (state.window.local(state.pos));
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
