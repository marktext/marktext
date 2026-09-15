// TeX delimiters `\(...\)` (inline) and `\[...\]` (display). These are
// first-class math spans — not a rewrite of `\[` into `$$` — so CommonMark's
// backslash-escape of `[` / `(` must not consume the opener first.
//
// A closer is the two-char sequence `\)` / `\]` whose leading backslash is
// not itself escaped: after any other `\` we skip the next character (so
// `\\` is a literal backslash and `\\)` does not close).

export type TLatexMathKind = 'inline' | 'display';

export interface ILatexMathMatch {
    raw: string;
    text: string;
    kind: TLatexMathKind;
    open: '\\(' | '\\[';
    close: '\\)' | '\\]';
}

export function matchLatexMath(src: string): ILatexMathMatch | null {
    if (src.startsWith('\\('))
        return scan(src, '\\(', '\\)', 'inline');
    if (src.startsWith('\\['))
        return scan(src, '\\[', '\\]', 'display');
    return null;
}

// Block-level `\[...\]` only: the closer must be the last thing on the
// line (optional trailing whitespace, then newline or EOF). `foo \[x\] bar`
// stays a paragraph so the inline lexer can still render the span; a
// dedicated block would swallow the trailing prose.
export function matchLatexDisplayBlock(src: string): ILatexMathMatch | null {
    const indentMatch = /^ {0,3}/.exec(src);
    const indent = indentMatch ? indentMatch[0].length : 0;
    if (!src.startsWith('\\[', indent))
        return null;

    const scanned = scan(src.slice(indent), '\\[', '\\]', 'display');
    if (!scanned)
        return null;

    const after = src.slice(indent + scanned.raw.length);
    const trail = /^[ \t]*(?:\n|$)/.exec(after);
    if (!trail)
        return null;

    return {
        raw: src.slice(0, indent + scanned.raw.length + trail[0].length),
        text: scanned.text.trim(),
        kind: 'display',
        open: '\\[',
        close: '\\]',
    };
}

function scan(
    src: string,
    open: '\\(' | '\\[',
    close: '\\)' | '\\]',
    kind: TLatexMathKind,
): ILatexMathMatch | null {
    const closeChar = close[1];
    let i = open.length;
    while (i < src.length) {
        if (src[i] === '\\') {
            if (src[i + 1] === closeChar) {
                const text = src.slice(open.length, i);
                if (!text)
                    return null;
                return {
                    raw: src.slice(0, i + 2),
                    text,
                    kind,
                    open,
                    close,
                };
            }
            i += 2;
            continue;
        }
        i += 1;
    }
    return null;
}
