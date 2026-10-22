import type { MarkedExtension } from 'marked';

// Mirrors the editor's `inline_diff` rule (inlineRenderer/rules.ts): one
// pattern per delimiter pair, so a mixed `{+ … +]` cannot match.
const RULES = [
    /^(\{\+)(?!\s*\+\})([^\n]+?)\+\}/,
    /^(\[\+)(?!\s*\+\])([^\n]+?)\+\]/,
    /^(\{-)(?!\s*-\})([^\n]+?)-\}/,
    /^(\[-)(?!\s*-\])([^\n]+?)-\]/,
];
const START = /\{[+-]|\[[+-]/;

interface IInlineDiffToken {
    type: 'inlineDiff';
    raw: string;
    marker: string;
    text: string;
}

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
                    const match = RULES.map(rule => rule.exec(src)).find(Boolean);
                    if (!match)
                        return;

                    return {
                        type: 'inlineDiff',
                        raw: match[0],
                        marker: match[1],
                        text: match[2],
                    };
                },
                renderer(token) {
                    const { marker, text } = token as IInlineDiffToken;
                    const addition = marker[1] === '+';
                    const tag = addition ? 'ins' : 'del';
                    const variant = addition ? 'addition' : 'deletion';

                    return `<${tag} class="idiff ${variant}">${escapeText(text)}</${tag}>`;
                },
            },
        ],
    };
}
