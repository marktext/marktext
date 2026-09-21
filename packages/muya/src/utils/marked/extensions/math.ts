import type { Token } from 'marked';
import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

// marked resolves a token's renderer by looking its `type` up among the
// registered extension names, so each inline tokenizer has to emit its own
// name as the type. Emitting a shared `inlineMath` made the gfm extension
// depend on the dollar extension being registered too, and parsing threw
// "Token with inlineMath type was not found" whenever tex_math_dollars was off.
export type TInlineMathType = 'inlineMath' | 'inlineMathGfm';

export interface IMathToken {
    type: TInlineMathType | 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    marker?: string;
    // Only `` $`…`$ `` needs this: every other form closes on its own marker.
    closeMarker?: string;
    mathStyle?: '' | 'gfm';
}

interface IOptions {
    throwOnError?: boolean;
    useKatexRender?: boolean;
}

// Kept in lockstep with the editor's `inline_math` rule
// (inlineRenderer/rules.ts) so that a document reads the same while editing and
// on export (#5446). Same shape, minus bare newlines: math never spans a line
// on this path. A `$` may open a span mid-word, as pandoc and the editor both
// allow, so the start hint carries no flanking requirement of its own.
const inlineStartRule = /\${1,2}(?!\$)/g;
const inlineRule
    = /^(?!\$(?!\$)(?:[^$\\\n]|\\.)*(?:\s\$|\$\d))(\$\$(?!\$)|\$(?=\S))((?:(?!\1)[^\\\n]|\\.)+)\1(?!\1)/;
const blockRule = /^(\${1,2})\n((?:\\[\s\S]|[^\\])+?)\n\1[ \t]*(?:\n|$)/;

// GitHub's inline math, pandoc's `tex_math_gfm` — mirrors the editor's
// `inline_math_gfm` rule.
const gfmStartRule = /\$`/g;
const gfmRule = /^(\$`)((?:[^`\\\n]|\\.)+)`\$/;

const DEFAULT_OPTIONS = {
    throwOnError: false,
    useKatexRender: false,
};

export default function (options: IOptions = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return {
        extensions: [
            inlineKatex(createRenderer(opts, false)),
            blockKatex(createRenderer(opts, true)),
        ],
        walkTokens: markDisplayMath,
    };
}

// Registered separately, and after the dollar extension: `Marked.use` unshifts,
// so the later registration is tried first and `` $`…`$ `` is claimed before
// `$…$` can take it with the backticks inside.
export function gfmMathExtension(options: IOptions = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return {
        extensions: [inlineGfmKatex(createRenderer(opts, false))],
    };
}

function isDollarDollarMath(token: Token): token is Token & IMathToken {
    return token.type === 'inlineMath' && (token as Partial<IMathToken>).marker === '$$';
}

// Same rule as the editor: `$$...$$` is display math only in a paragraph that
// holds nothing but such formulas. A tight list item's paragraph comes as a
// block-level `text` token; inline `text` tokens carry no `tokens`.
function markDisplayMath(token: Token) {
    const children = token.type === 'paragraph' || token.type === 'text' ? token.tokens : undefined;
    if (!children)
        return;

    const onlyMath = children.some(isDollarDollarMath)
        && children.every(child =>
            isDollarDollarMath(child)
            || child.type === 'br'
            || (child.type === 'text' && child.raw.trim() === ''),
        );

    if (!onlyMath)
        return;

    for (const child of children) {
        if (isDollarDollarMath(child))
            child.displayMode = true;
    }
}

function createRenderer(options: IOptions, newlineAfter: boolean) {
    return (token: IMathToken) => {
        const { useKatexRender, ...otherOpts } = options;
        const { type, text, displayMode, marker = '$', closeMarker = marker, mathStyle } = token;
        if (useKatexRender) {
            return (
                katex.renderToString(text, {
                    ...otherOpts,
                    displayMode,
                }) + (newlineAfter ? '\n' : '')
            );
        }
        else {
            return type === 'multiplemath'
                ? `<pre class="multiple-math" data-math-style="${mathStyle}">${text}</pre>\n`
                : `${marker}${text}${closeMarker}`;
        }
    };
}

function inlineGfmKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'inlineMathGfm',
        level: 'inline' as const,
        start(src: string) {
            gfmStartRule.lastIndex = 0;
            for (
                let match = gfmStartRule.exec(src);
                match;
                match = gfmStartRule.exec(src)
            ) {
                if (gfmRule.test(src.substring(match.index)))
                    return match.index;
            }
        },
        tokenizer(src: string) {
            const match = src.match(gfmRule);
            if (match) {
                return {
                    type: 'inlineMathGfm',
                    raw: match[0],
                    text: match[2].trim(),
                    marker: match[1],
                    closeMarker: '`$',
                    displayMode: false,
                };
            }
        },
        renderer,
    };
}

function inlineKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'inlineMath',
        level: 'inline' as const,
        // Every `$` is a candidate, not just the first one: marked stops the
        // surrounding text token here, so returning early on a `$` that turns
        // out not to open a formula would hide every later formula on the line
        // — "from $13B to $24B and $x+y$" must still find `$x+y$` (#5446).
        start(src: string) {
            inlineStartRule.lastIndex = 0;
            for (
                let match = inlineStartRule.exec(src);
                match;
                match = inlineStartRule.exec(src)
            ) {
                if (inlineRule.test(src.substring(match.index)))
                    return match.index;
            }
        },
        tokenizer(src: string) {
            const match = src.match(inlineRule);
            if (match) {
                return {
                    type: 'inlineMath',
                    raw: match[0],
                    text: match[2].trim(),
                    marker: match[1],
                    displayMode: false,
                };
            }
        },
        renderer,
    };
}

function blockKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'multiplemath',
        level: 'block' as const,
        start(src: string) {
            return src.indexOf('\n$');
        },
        tokenizer(src: string) {
            const match = src.match(blockRule);
            if (match) {
                return {
                    type: 'multiplemath',
                    raw: match[0],
                    text: match[2].trim(),
                    displayMode: match[1].length === 2,
                    mathStyle: '',
                };
            }
        },
        renderer,
    };
}
