import type { MarkedExtension, Token, Tokens } from 'marked';
import type { IDelimiterRun, IEmphasisSpan } from '../../emphasis';
import { Lexer, Tokenizer } from 'marked';
import { pairEmphasisDelimiters } from '../../emphasis';

// Deliberate CommonMark divergence: retain MarkText's CJK-adjacent emphasis (#4307).
const CJK = '\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7AF\\uFF66-\\uFF9D\\u{20000}-\\u{2A6DF}';
const punctuation = new RegExp(`[\\p{P}\\p{S}${CJK}]`, 'u');
const whitespace = /[\p{Zs}\t\n\f\r]/u;

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

function sliceText(token: Tokens.Text, start: number, end: number, lexer: Lexer): Tokens.Text {
    const raw = token.raw.slice(start, end);
    if (raw === token.raw)
        return token;
    if (token.escaped)
        return { ...token, raw, text: raw };

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
    return { ...token, raw, text };
}

function pairDelimiters(tokens: Token[], lexer: Lexer, boundaries: IBoundaries, processed: WeakSet<Token[]>): void {
    const gfm = lexer.options.gfm === true;
    const marker = gfm ? /[*_~]/ : /[*_]/;
    if (!tokens.some(token => isPlainText(token) && marker.test(token.raw)))
        return;

    const source = tokens.map(token => token.raw).join('');
    // Only actual parsed tokens shield delimiters; Marked's preliminary HTML/link mask also matches invalid syntax.
    const masked = tokens.map(token => isPlainText(token) ? token.raw : token.raw.replace(/[*_~]/g, '+')).join('');
    const spans = pairEmphasisDelimiters(collectRuns(masked, boundaries, gfm));
    if (!spans.size)
        return;

    let offset = 0;
    const ranges: ITokenRange[] = tokens.map((token) => {
        const start = offset;
        offset += token.raw.length;
        return { token, start, end: offset };
    });
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

function pairInlineTokens(tokens: Token[], lexer: Lexer, boundaries: IBoundaries, processed: WeakSet<Token[]>): void {
    if (processed.has(tokens))
        return;
    pairDelimiters(tokens, lexer, boundaries, processed);
    processed.add(tokens);
}

export default function cjkEmStrongExtension(): MarkedExtension {
    const boundaries = new WeakMap<Lexer, IBoundaries>();
    const processed = new WeakSet<Token[]>();
    const inLinkLabel = <T>(lexer: Lexer, tokenize: () => T): T => {
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
                const lexer = new Lexer(this.options);
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
                    const lexer = new Lexer(options);
                    const inlineTokens = lexer.inlineTokens.bind(lexer);
                    lexer.inlineTokens = (source, tokens = []) => {
                        const edges = boundaries.get(lexer) ?? { before: '\n', after: '\n' };
                        boundaries.delete(lexer);
                        const parsed = inlineTokens(source, tokens);
                        // Pair once per inline scope, preserving already-parsed links, code and extension tokens.
                        if (!options?.pedantic)
                            pairInlineTokens(parsed, lexer, edges, processed);
                        return parsed;
                    };
                    return block ? lexer.lex(source) : lexer.inlineTokens(source);
                };
            },
        },
    };
}
