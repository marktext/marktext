import type { MarkedExtension } from 'marked';

// GitLab Flavored Markdown inline diffs, kept in lockstep with the editor
// (inlineRenderer/rules.ts `inline_diff`). The opener is `{+`/`[+`/`{-`/`[-`
// and the closer mirrors it with the same sign; the `\2` back-reference plus
// the bracket check below reject the mixed `{+ … -]` form GitLab also rejects.
const RULE = /^([{[])([+-])([^\n]*?)\2([}\]])/;
const START = /\{[+-]|\[[+-]/;

interface IInlineDiffToken {
    type: 'inlineDiff';
    raw: string;
    text: string;
    kind: 'ins' | 'del';
}

// The body is rendered as literal text — GitLab's diff tag is a text-node
// filter, so nested markdown inside the span does not apply. Escaping here
// keeps `{+ <b> +}` literal, matching the editor's plain-text rendering.
function escapeText(value: string): string {
    return value.replace(/[&<>"]/g, (c) => {
        switch (c) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            default: return '&quot;';
        }
    });
}

export default function inlineDiffExtension(): MarkedExtension {
    return {
        extensions: [
            {
                name: 'inlineDiff',
                level: 'inline',
                start(src: string) {
                    const i = src.search(START);
                    return i === -1 ? undefined : i;
                },
                tokenizer(src: string): IInlineDiffToken | undefined {
                    const match = RULE.exec(src);
                    if (!match)
                        return;

                    const [, open, sign, content, close] = match;
                    if (!((open === '{' && close === '}') || (open === '[' && close === ']')))
                        return;

                    return {
                        type: 'inlineDiff',
                        raw: match[0],
                        text: content,
                        kind: sign === '+' ? 'ins' : 'del',
                    };
                },
                renderer(token) {
                    const { kind, text } = token as IInlineDiffToken;
                    const tag = kind === 'ins' ? 'ins' : 'del';

                    return `<${tag}>${escapeText(text)}</${tag}>`;
                },
            },
        ],
    };
}
