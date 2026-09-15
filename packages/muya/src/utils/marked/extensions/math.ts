import type { Token } from 'marked';
import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

export interface IMathToken {
    type: 'inlineMath' | 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    marker?: string;
    mathStyle?: '' | 'gitlab';
}

interface IOptions {
    throwOnError?: boolean;
    useKatexRender?: boolean;
}

const inlineStartRule = /(\s|^)\${1,2}(?!\$)/;
const inlineRule
    = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:]|$)/;
const blockRule = /^(\${1,2})\n((?:\\[\s\S]|[^\\])+?)\n\1[ \t]*(?:\n|$)/;

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
        walkTokens: displayMathWalker(),
    };
}

function isDollarDollarMath(token: Token): token is Token & IMathToken {
    return token.type === 'inlineMath' && (token as Partial<IMathToken>).marker === '$$';
}

function forEachDescendant(token: Token, callback: (token: Token) => void) {
    const children = [
        ...('tokens' in token && Array.isArray(token.tokens) ? token.tokens : []),
        ...('items' in token && Array.isArray(token.items) ? token.items : []),
    ];
    for (const child of children) {
        callback(child);
        forEachDescendant(child, callback);
    }
}

// Same rule as the editor and GitHub: `$$...$$` is display math only in a
// paragraph that holds nothing but such formulas, and never inside a list item.
// marked walks a parent before its children, so list items flag their
// paragraphs before those are visited.
function displayMathWalker() {
    const listItemParagraphs = new WeakSet<Token>();

    return (token: Token) => {
        if (token.type === 'list_item') {
            forEachDescendant(token, (child) => {
                if (child.type === 'paragraph')
                    listItemParagraphs.add(child);
            });
            return;
        }

        if (token.type !== 'paragraph' || listItemParagraphs.has(token))
            return;

        const children = token.tokens ?? [];
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
    };
}

function createRenderer(options: IOptions, newlineAfter: boolean) {
    return (token: IMathToken) => {
        const { useKatexRender, ...otherOpts } = options;
        const { type, text, displayMode, marker = '$', mathStyle } = token;
        if (useKatexRender) {
            return (
                katex.renderToString(text, {
                    ...otherOpts,
                    displayMode,
                }) + (newlineAfter ? '\n' : '')
            );
        }
        else {
            return type === 'inlineMath'
                ? `${marker}${text}${marker}`
                : `<pre class="multiple-math" data-math-style="${mathStyle}">${text}</pre>\n`;
        }
    };
}

function inlineKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'inlineMath',
        level: 'inline' as const,
        start(src: string) {
            const match = src.match(inlineStartRule);
            if (!match)
                return;

            const index = (match.index || 0) + match[1].length;
            const possibleKatex = src.substring(index);

            if (inlineRule.test(possibleKatex))
                return index;
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
