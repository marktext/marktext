import type { Token } from 'marked';
import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

// marked resolves a token's renderer by looking its `type` up among the
// registered extension names, so each inline tokenizer has to emit its own
// name as the type. Emitting a shared `inlineMath` made the gfm extension
// depend on the dollar extension being registered too, and parsing threw
// "Token with inlineMath type was not found" whenever tex_math_dollars was off.
export type TInlineMathType
    = | 'inlineMath'
        | 'inlineMathGfm'
        | 'inlineMathSingleBackslash'
        | 'displayMathSingleBackslash';

const INLINE_MATH_TYPES = new Set<string>([
    'inlineMath',
    'inlineMathGfm',
    'inlineMathSingleBackslash',
    'displayMathSingleBackslash',
]);

// The openers that carry display rather than inline math.
const DISPLAY_MATH_MARKERS = new Set(['$$', '\\[']);

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

// pandoc's `tex_math_single_backslash` — mirrors the editor's
// `inline_math_single_backslash` / `display_math_single_backslash` rules.
// Unlike the dollar rules these admit newlines: `\[` and `\]` on their own
// lines is the ordinary spelling of a display formula, and pandoc reads a soft
// line break inside `\(…\)` too. A blank line still ends the span, because
// marked has already cut the paragraph by the time the rule runs.
const singleInlineStartRule = /\\\(/g;
const singleInlineRule = /^(\\\()((?:[^\\]|\\[^)])+)\\\)/;
const singleDisplayStartRule = /\\\[/g;
const singleDisplayRule = /^(\\\[)((?:[^\\]|\\[^\]])+)\\\]/;

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
// Registered after the dollar extension for the same reason as the gfm one,
// though the two cannot collide: `\(` and `\[` open on a backslash. It carries
// its own `markDisplayMath`, because the dollar extension that normally
// supplies it may not be registered at all.
export function singleBackslashMathExtension(options: IOptions = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return {
        extensions: [
            backslashKatex(
                'inlineMathSingleBackslash',
                singleInlineStartRule,
                singleInlineRule,
                '\\)',
                createRenderer(opts, false),
            ),
            backslashKatex(
                'displayMathSingleBackslash',
                singleDisplayStartRule,
                singleDisplayRule,
                '\\]',
                createRenderer(opts, false),
            ),
        ],
        walkTokens: markDisplayMath,
    };
}

export function gfmMathExtension(options: IOptions = {}) {
    const opts = Object.assign({}, DEFAULT_OPTIONS, options);

    return {
        extensions: [inlineGfmKatex(createRenderer(opts, false))],
    };
}

function isDisplayMathSpan(token: Token): token is Token & IMathToken {
    const { marker } = token as Partial<IMathToken>;

    return INLINE_MATH_TYPES.has(token.type) && marker !== undefined && DISPLAY_MATH_MARKERS.has(marker);
}

// Same rule as the editor: a display formula is display math only in a
// paragraph that holds nothing but such formulas. A tight list item's paragraph
// comes as a block-level `text` token; inline `text` tokens carry no `tokens`.
function markDisplayMath(token: Token) {
    const children = token.type === 'paragraph' || token.type === 'text' ? token.tokens : undefined;
    if (!children)
        return;

    const onlyMath = children.some(isDisplayMathSpan)
        && children.every(child =>
            isDisplayMathSpan(child)
            || child.type === 'br'
            || (child.type === 'text' && child.raw.trim() === ''),
        );

    if (!onlyMath)
        return;

    for (const child of children) {
        if (isDisplayMathSpan(child))
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

function backslashKatex(
    name: TInlineMathType,
    startRule: RegExp,
    rule: RegExp,
    closeMarker: string,
    renderer: (token: IMathToken) => string,
) {
    return {
        name,
        level: 'inline' as const,
        // Every opener is a candidate, not just the first: marked ends the
        // surrounding text token here, so bailing out on one that turns out not
        // to open a formula would hide every later formula on the line.
        start(src: string) {
            startRule.lastIndex = 0;
            for (
                let match = startRule.exec(src);
                match;
                match = startRule.exec(src)
            ) {
                if (rule.test(src.substring(match.index)))
                    return match.index;
            }
        },
        tokenizer(src: string) {
            const match = src.match(rule);
            if (match) {
                return {
                    type: name,
                    raw: match[0],
                    text: match[2].trim(),
                    marker: match[1],
                    closeMarker,
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
