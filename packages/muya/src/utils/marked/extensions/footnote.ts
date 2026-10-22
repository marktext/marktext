import type { Lexer, MarkedExtension, Tokens } from 'marked';

// Marked binds lexer/parser on hook contexts, but public types omit these internal members.
interface IFootnoteTokenizerThis {
    lexer: Lexer;
}
interface IFootnoteRendererThis {
    parser?: { parse: (toks: Tokens.Generic[]) => string };
}

// Block-level rule for footnote definitions, applied at the start of the
// marked tokenizer's remaining source rather than against a per-line buffer.
//
// The `(?<!\\)` lookbehind in front of the closing `]` lets users escape
// the bracket — `[^foo\]: bar` stays a paragraph instead of becoming a
// footnote with identifier `foo\`. The `:[\s\S]*?` after the marker uses
// `*` (not `+`) so a bare `[^id]:` followed only by a newline is still
// recognised as an empty footnote.
//
// The body ends at a blank line, at the start of the next column-0
// definition, or at end of input. That middle terminator is what keeps
// definitions packed one per line — the shape pandoc and GFM both emit —
// as siblings. Indented (4-space) definitions stay body text, matching
// the continuation rule.
const BLOCK_RULE = /^\[\^([^^[\]\s]+)(?<!\\)\]:([\s\S]*?)(?=\n *\n {0,3}[^ ]|\n\[\^[^^[\]\s]+(?<!\\)\]:|$)/;

// Inline `[^id]` reference. Tokenising it here rather than regexing marked's
// finished HTML is what makes `\[^id]` stay literal: marked's own escape rule
// claims the `\[` before this tokenizer is ever offered the position. For the
// same reason code spans and fenced code need no special handling — marked
// never runs inline extensions over their contents.
const INLINE_RULE = /^\[\^([^^[\]\s]+)\]/;

interface IFootnoteToken {
    type: 'footnote';
    raw: string;
    identifier: string;
    tokens: Tokens.Generic[];
}

interface IFootnoteRefToken {
    type: 'footnoteRef';
    raw: string;
    identifier: string;
}

export default function footnoteExtension(): MarkedExtension {
    // Disable both hooks inside note bodies: nested notes remain literal.
    let inFootnoteBody = false;

    return {
        extensions: [
            {
                name: 'footnote',
                level: 'block',
                start(src: string) {
                    if (inFootnoteBody)
                        return;
                    // Marked passes src.slice(1); only a real newline before the identifier ends a paragraph.
                    const m = /\n\[\^[^^[\]\s]+(?<!\\)\]:/.exec(src);
                    return m ? m.index + 1 : undefined;
                },
                tokenizer(src: string): IFootnoteToken | undefined {
                    if (inFootnoteBody)
                        return;
                    const match = BLOCK_RULE.exec(src);
                    if (!match)
                        return;

                    const [raw, identifier, rest] = match;
                    // Strip initial whitespace and four-space continuation indentation before lexing the body.
                    const cleaned = rest
                        .replace(/^[ \t]*/, '')
                        .replace(/^\n+/, '')
                        .replace(/^ {4}/, '')
                        .replace(/\n {4}(?=\S)/g, '\n')
                        .replace(/\n+$/, '');

                    // Use the bound lexer so nested content is parsed with the
                    // same Marked instance + extensions (math, etc.). A bare
                    // `new Lexer()` would fall back to the global defaults and
                    // re-introduce the "sticky extension" leak the per-call
                    // Marked instance is meant to prevent.
                    // Marked's `TokenizerThis` is `void` in the public types;
                    // the runtime context exposes `lexer` for nested block
                    // parsing. Project this context once per hook.
                    // eslint-disable-next-line no-restricted-syntax
                    const { lexer } = this as unknown as IFootnoteTokenizerThis;
                    inFootnoteBody = true;
                    let tokens: Tokens.Generic[];
                    try {
                        tokens = cleaned
                            ? (lexer.blockTokens(cleaned, []) as Tokens.Generic[])
                            : [];
                    }
                    finally {
                        inFootnoteBody = false;
                    }

                    return {
                        type: 'footnote',
                        raw,
                        identifier,
                        tokens,
                    };
                },
                renderer(token) {
                    if (token.type !== 'footnote')
                        return false;
                    const t = token as IFootnoteToken;
                    const { parser } = this as IFootnoteRendererThis;
                    const inner = parser ? parser.parse(t.tokens) : '';
                    return `<div class="footnote-block" data-identifier="${escapeAttr(t.identifier)}">${inner}</div>\n`;
                },
            },
            {
                name: 'footnoteRef',
                level: 'inline',
                start(src: string) {
                    const i = src.indexOf('[^');
                    return i === -1 ? undefined : i;
                },
                tokenizer(src: string): IFootnoteRefToken | undefined {
                    const match = INLINE_RULE.exec(src);
                    if (!match)
                        return;

                    return { type: 'footnoteRef', raw: match[0], identifier: match[1] };
                },
                renderer(token) {
                    if (token.type !== 'footnoteRef')
                        return false;
                    const t = token as IFootnoteRefToken;

                    // Emit a marker: transformFootnotes numbers references after seeing the whole document.
                    return `<span class="footnote-ref" data-identifier="${escapeAttr(t.identifier)}"></span>`;
                },
            },
        ],
    };
}

function escapeAttr(s: string): string {
    return s.replace(/[&<>"]/g, (c) => {
        switch (c) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
