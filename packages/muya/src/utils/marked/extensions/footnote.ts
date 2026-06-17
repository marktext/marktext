import type { Lexer, MarkedExtension, Tokens } from 'marked';

// marked's `tokenizer`/`renderer` hooks are bound to a context object that
// exposes the active `lexer` (for nested block tokenisation) and `parser`
// (for rendering nested tokens). Marked's public `RendererThis` /
// `TokenizerThis` types don't surface those fields, so we declare narrow
// structural views and narrow `this` once per hook.
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
const BLOCK_RULE = /^\[\^([^^[\]\s]+)(?<!\\)\]:([\s\S]*?)(?=\n *\n {0,3}[^ ]|$)/;

interface IFootnoteToken {
    type: 'footnote';
    raw: string;
    identifier: string;
    tokens: Tokens.Generic[];
}

export default function footnoteExtension(): MarkedExtension {
    return {
        extensions: [
            {
                name: 'footnote',
                level: 'block',
                start(src: string) {
                    // Marked calls start() with `src.slice(1)` to look for the
                    // earliest position the paragraph should terminate at.
                    // Only signal a match when `[^id]:` follows an actual
                    // newline inside that slice — never when the slice merely
                    // begins with `[^`, because that would split paragraphs
                    // at inline footnote references like `Lorem [^1] ipsum`.
                    const m = /\n\[\^[^^[\]\s]+(?<!\\)\]:/.exec(src);
                    return m ? m.index + 1 : undefined;
                },
                tokenizer(src: string): IFootnoteToken | undefined {
                    const match = BLOCK_RULE.exec(src);
                    if (!match)
                        return;

                    const [raw, identifier, rest] = match;
                    // Strip leading whitespace after the `:` marker (so both
                    // `[^id]: text` and `[^id]:\n    text` start clean) and
                    // de-indent the 4-space continuation indent on every
                    // line. The first line needs an explicit `^ {4}` strip
                    // because the per-line de-indent rule below is anchored
                    // to a preceding `\n`; without that strip an indented-
                    // continuation body (`[^id]:\n    text`) lexes as an
                    // indented code block instead of a paragraph.
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
                    const tokens = cleaned
                        ? (lexer.blockTokens(cleaned, []) as Tokens.Generic[])
                        : [];

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
                    // The parser is bound to `this` at render time.
                    const { parser } = this as IFootnoteRendererThis;
                    const inner = parser ? parser.parse(t.tokens) : '';
                    return `<div class="footnote-block" data-identifier="${escapeAttr(t.identifier)}">${inner}</div>\n`;
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
