import type { MarkedExtension, MarkedOptions, Token, Tokens } from 'marked';
import type { IDelimiterPairingOptions, IDelimiterRun, IEmphasisSpan } from '../../emphasis';
import { Lexer, Tokenizer } from 'marked';
import { pairEmphasisDelimiters } from '../../emphasis';

// Deliberate CommonMark divergence: retain MarkText's CJK-adjacent emphasis (#4307).
const CJK = '\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7AF\\uFF66-\\uFF9D\\u{20000}-\\u{2A6DF}';
const punctuation = new RegExp(`[\\p{P}\\p{S}${CJK}]`, 'u');
const whitespace = /[\p{Zs}\t\n\f\r]/u;

type TTokenLexer = Lexer<unknown, unknown>;
type TRelex = (source: string, limits: ReadonlyMap<number, number>, edges: IBoundaries) => Token[];
const relexers = new WeakMap<TTokenLexer, TRelex>();

interface IBoundaries {
    before: string;
    after: string;
}

function flanking(char: string, before: string, after: string) {
    const beforeWhitespace = whitespace.test(before);
    const afterWhitespace = whitespace.test(after);
    const beforePunctuation = punctuation.test(before);
    const afterPunctuation = punctuation.test(after);
    const leftFlanking = !afterWhitespace && (!afterPunctuation || beforeWhitespace || beforePunctuation);
    const rightFlanking = !beforeWhitespace && (!beforePunctuation || afterWhitespace || afterPunctuation);
    return {
        canOpen: leftFlanking && (char !== '_' || !rightFlanking || beforePunctuation),
        canClose: rightFlanking && (char !== '_' || !leftFlanking || afterPunctuation),
    };
}

function collectRuns(src: string, boundaries: IBoundaries, gfm: boolean): IDelimiterRun[] {
    const runs: IDelimiterRun[] = [];
    let i = 0;
    while (i < src.length) {
        const char = src[i];
        if (char !== '*' && char !== '_' && !(gfm && char === '~')) {
            i++;
            continue;
        }

        const start = i;
        while (src[i] === char)
            i++;
        if (char === '~' && i - start > 2)
            continue;

        const before = [...src.slice(Math.max(0, start - 2), start)].at(-1) ?? boundaries.before;
        const after = i < src.length ? String.fromCodePoint(src.codePointAt(i)!) : boundaries.after;

        runs.push({
            char,
            length: i - start,
            left: start,
            right: i,
            ...flanking(char, before, after),
        });
    }
    return runs;
}

interface ITokenRange {
    token: Token;
    start: number;
    end: number;
}

function isPlainText(token: Token): token is Tokens.Text {
    return token.type === 'text' && !token.tokens;
}

function isBareUrl(token: Token): token is Tokens.Link {
    return token.type === 'link' && token.autolink === true && !token.raw.startsWith('<');
}

function decodeText<ParserOutput, RendererOutput>(raw: string, lexer: Lexer<ParserOutput, RendererOutput>): string {
    // Reuse Marked's character-reference decoding without recognizing new syntax in a text fragment.
    const inRawBlock = lexer.state.inRawBlock;
    lexer.state.inRawBlock = false;
    let text = '';
    let rest = raw;
    try {
        while (rest) {
            const part = Tokenizer.prototype.inlineText.call(lexer.options.tokenizer!, rest)!;
            text += part.text;
            rest = rest.slice(part.raw.length);
        }
    }
    finally {
        lexer.state.inRawBlock = inRawBlock;
    }
    return text;
}

function sliceText<ParserOutput, RendererOutput>(token: Tokens.Text, start: number, end: number, lexer: Lexer<ParserOutput, RendererOutput>): Tokens.Text {
    const raw = token.raw.slice(start, end);
    if (raw === token.raw)
        return token;
    return { ...token, raw, text: token.escaped ? raw : decodeText(raw, lexer) };
}

function maskCodeAndEscapes<ParserOutput, RendererOutput>(source: string, lexer: Lexer<ParserOutput, RendererOutput>): string {
    const rules = lexer.options.tokenizer!.rules.inline;
    let masked = '';
    let index = 0;
    while (index < source.length) {
        const char = source[index];
        const match = char === '\\' ? rules.escape.exec(source.slice(index)) : char === '`' ? rules.code.exec(source.slice(index)) : null;
        if (match) {
            masked += match[0].replace(/[*_~]/g, '+');
            index += match[0].length;
        }
        else {
            masked += char;
            index++;
        }
    }
    return masked;
}

function bareUrlPrecedence<ParserOutput, RendererOutput>(ranges: ITokenRange[], source: string, lexer: Lexer<ParserOutput, RendererOutput>) {
    const urls = ranges.filter(range => isBareUrl(range.token)).map(({ start, end }) => ({ start, end }));
    const containingUrl = (pos: number) => urls.find(url => url.start <= pos && pos < url.end);
    const limits = new Map<number, number>();
    const options: IDelimiterPairingOptions = {
        // Interior URL markers can close existing formatting, but cannot independently open formatting.
        mayOpen: run => !containingUrl(run.left),
        onPair(span) {
            const url = containingUrl(span.end - span.markerLen);
            if (!url || span.start >= url.start)
                return;
            url.end = span.end - span.markerLen;
            limits.set(url.start, url.end);
            // Text after the closing run is outside the URL and may begin another bare link.
            const next = Tokenizer.prototype.url.call(lexer.options.tokenizer!, source.slice(span.end));
            if (next)
                urls.push({ start: span.end, end: span.end + next.raw.length });
        },
    };
    return { options, limits };
}

function pairDelimiters<ParserOutput, RendererOutput>(tokens: Token[], lexer: Lexer<ParserOutput, RendererOutput>, boundaries: IBoundaries, processed: WeakSet<Token[]>): void {
    const gfm = lexer.options.gfm === true;
    const marker = gfm ? /[*_~]/ : /[*_]/;
    if (!tokens.some(token => isPlainText(token) && marker.test(token.raw)))
        return;

    const source = tokens.map(token => token.raw).join('');
    // Only actual parsed tokens shield delimiters; Marked's preliminary HTML/link mask also matches invalid syntax.
    let masked = tokens.map(token => isPlainText(token) || isBareUrl(token) ? token.raw : token.raw.replace(/[*_~`\\]/g, '+')).join('');
    // A prospective bare URL can contain higher-priority code or escapes that the initial URL token swallowed.
    if (tokens.some(isBareUrl))
        masked = maskCodeAndEscapes(masked, lexer);

    let offset = 0;
    const ranges: ITokenRange[] = tokens.map((token) => {
        const start = offset;
        offset += token.raw.length;
        return { token, start, end: offset };
    });
    const precedence = bareUrlPrecedence(ranges, source, lexer);
    const spans = pairEmphasisDelimiters(collectRuns(masked, boundaries, gfm), 0, precedence.options);
    const relex = relexers.get(lexer);
    if (precedence.limits.size && relex) {
        // Re-lex the narrowed URLs so their former tails can become escapes, code or other inline syntax.
        const replayed = relex(source, precedence.limits, boundaries);
        tokens.length = 0;
        for (const token of replayed)
            tokens.push(token);
        return;
    }
    if (!spans.size)
        return;
    const starts = [...spans.keys()].sort((a, b) => a - b);
    let rangeIndex = 0;
    let spanIndex = 0;

    const group = (start: number, end: number): Token[] => {
        const result: Token[] = [];
        processed.add(result);
        let pos = start;
        while (pos < end) {
            const span: IEmphasisSpan | undefined = spans.get(pos);
            if (span) {
                const innerStart = pos + span.markerLen;
                const innerEnd = span.end - span.markerLen;
                result.push({
                    type: source[pos] === '~' ? 'del' : span.markerLen === 2 ? 'strong' : 'em',
                    raw: source.slice(pos, span.end),
                    text: source.slice(innerStart, innerEnd),
                    tokens: group(innerStart, innerEnd),
                });
                pos = span.end;
                continue;
            }

            while (ranges[rangeIndex].end <= pos)
                rangeIndex++;
            while (spanIndex < starts.length && starts[spanIndex] <= pos)
                spanIndex++;

            const range = ranges[rangeIndex];
            const next = Math.min(end, range.end, starts[spanIndex] ?? end);
            result.push(isPlainText(range.token)
                ? sliceText(range.token, pos - range.start, next - range.start, lexer)
                : range.token);
            pos = next;
        }
        return result;
    };

    const grouped = group(0, source.length);
    tokens.length = 0;
    for (const token of grouped)
        tokens.push(token);
}

function pairInlineTokens<ParserOutput, RendererOutput>(tokens: Token[], lexer: Lexer<ParserOutput, RendererOutput>, boundaries: IBoundaries, processed: WeakSet<Token[]>): void {
    if (processed.has(tokens))
        return;
    pairDelimiters(tokens, lexer, boundaries, processed);
    processed.add(tokens);
}

export default function cjkEmStrongExtension(): MarkedExtension {
    const boundaries = new WeakMap<TTokenLexer, IBoundaries>();
    const processed = new WeakSet<Token[]>();
    const inLinkLabel = <T, ParserOutput, RendererOutput>(lexer: Lexer<ParserOutput, RendererOutput>, tokenize: () => T): T => {
        const previous = boundaries.get(lexer);
        // Brackets still determine flanking at label edges, even though pairing cannot cross the link.
        boundaries.set(lexer, { before: '[', after: ']' });
        try {
            return tokenize();
        }
        finally {
            if (previous)
                boundaries.set(lexer, previous);
            else
                boundaries.delete(lexer);
        }
    };

    const createLexer = <ParserOutput, RendererOutput>(options: MarkedOptions<ParserOutput, RendererOutput>, limitedSource?: string, limits: ReadonlyMap<number, number> = new Map()): Lexer<ParserOutput, RendererOutput> => {
        let activeSource = '';
        const tokenizer = Object.assign(new Tokenizer<ParserOutput, RendererOutput>(), options.tokenizer);
        tokenizer.url = function (src) {
            const end = activeSource === limitedSource ? limits.get(activeSource.length - src.length) : undefined;
            const input = end === undefined ? src : src.slice(0, end - (activeSource.length - src.length));
            return Tokenizer.prototype.url.call(this, input);
        };
        const lexer = new Lexer({ ...options, tokenizer });
        const inlineTokens = lexer.inlineTokens.bind(lexer);
        lexer.inlineTokens = (source, tokens = []) => {
            const edges = boundaries.get(lexer) ?? { before: '\n', after: '\n' };
            const state = { ...lexer.state };
            const previousSource = activeSource;
            const previousRelex = relexers.get(lexer);
            const original = options.tokenizer;
            const originalState = original && { lexer: original.lexer, rules: original.rules, options: original.options };
            activeSource = source;
            boundaries.delete(lexer);
            try {
                // Marked's use() wrappers close over the original tokenizer, even when its methods are cloned.
                if (original)
                    Object.assign(original, { lexer, rules: tokenizer.rules, options: lexer.options });
                const parsed = inlineTokens(source, tokens);
                relexers.set(lexer, (text, cuts, edges) => {
                    const merged = new Map(text === limitedSource ? limits : []);
                    for (const [start, end] of cuts)
                        merged.set(start, Math.min(end, merged.get(start) ?? end));
                    const replay = createLexer(options, text, merged);
                    replay.state = { ...state };
                    replay.tokens.links = lexer.tokens.links;
                    boundaries.set(replay, edges);
                    return replay.inlineTokens(text);
                });
                if (!options.pedantic)
                    pairInlineTokens(parsed, lexer, edges, processed);
                return parsed;
            }
            finally {
                if (original && originalState)
                    Object.assign(original, originalState);
                activeSource = previousSource;
                if (previousRelex)
                    relexers.set(lexer, previousRelex);
                else
                    relexers.delete(lexer);
            }
        };
        return lexer;
    };

    return {
        tokenizer: {
            link(src) {
                if (src[0] !== '[' && !src.startsWith('!['))
                    return undefined;
                return inLinkLabel(this.lexer, () => Tokenizer.prototype.link.call(this, src));
            },
            reflink(src, links) {
                if (src[0] !== '[' && !src.startsWith('!['))
                    return undefined;
                return inLinkLabel(this.lexer, () => Tokenizer.prototype.reflink.call(this, src, links));
            },
            emStrong(this: Tokenizer) {
                return this.options.pedantic ? false : undefined;
            },
            del(this: Tokenizer) {
                return this.options.pedantic ? false : undefined;
            },
        },
        hooks: {
            processAllTokens(tokens) {
                if (this.options.pedantic)
                    return tokens;
                const lexer = createLexer(this.options);
                if ('links' in tokens)
                    lexer.tokens.links = tokens.links;
                relexers.set(lexer, (source, limits, edges) => {
                    const replay = createLexer(this.options, source, limits);
                    replay.tokens.links = lexer.tokens.links;
                    boundaries.set(replay, edges);
                    return replay.inlineTokens(source);
                });
                const visit = (scope: Token[], edges: IBoundaries = { before: '\n', after: '\n' }) => {
                    if (processed.has(scope))
                        return;
                    for (const token of scope) {
                        if (token.type === 'table') {
                            for (const cell of [...token.header, ...token.rows.flat()])
                                visit(cell.tokens);
                        }
                        else if (token.type === 'list') {
                            for (const item of token.items)
                                visit(item.tokens);
                        }
                        else if ('tokens' in token && token.tokens) {
                            visit(token.tokens, token.type === 'link' || token.type === 'image'
                                ? { before: '[', after: ']' }
                                : undefined);
                        }
                    }
                    pairInlineTokens(scope, lexer, edges, processed);
                };
                // Extensions may lex new inline scopes in their own processAllTokens hooks.
                visit(tokens);
                return tokens;
            },
            provideLexer() {
                const block = this.block;
                return (source, options) => {
                    const lexer = createLexer(options ?? {});
                    return block ? lexer.lex(source) : lexer.inlineTokens(source);
                };
            },
        },
    };
}
