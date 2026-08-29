import katex from 'katex';
import 'katex/dist/contrib/mhchem.mjs';

export interface IMathToken {
    type: 'inlineMath' | 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    mathStyle?: '' | 'gitlab';
}

interface IOptions {
    throwOnError?: boolean;
    useKatexRender?: boolean;
}

const inlineStartRule = /(?:^|[^\\])(\${1,2})(?!\$)/;
const inlineRule
    = /^(\${1,2})(?!\$)((?:\\.|[^\\$\n])+?)\1(?![0-9$])/;
const blockRule = /^(\${2})(?:\n((?:\\[\s\S]|[^\\])+?)\n|\s*([^\n]+?)\s*)\1[ \t]*(?:\n|$)/;

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
    };
}

function createRenderer(options: IOptions, newlineAfter: boolean) {
    return (token: IMathToken) => {
        const { useKatexRender, ...otherOpts } = options;
        const { type, text, displayMode, mathStyle } = token;
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
                ? (displayMode ? `$$${text}$$` : `$${text}$`)
                : `<pre class="multiple-math" data-math-style="${mathStyle}">${text}</pre>\n`;
        }
    };
}

function inlineKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'inlineMath',
        level: 'inline' as const,
        start(src: string) {
            let match: RegExpExecArray | null;
            const re = new RegExp(inlineStartRule.source, 'g');
            while ((match = re.exec(src)) !== null) {
                const index = match.index + (match[0].startsWith('$') ? 0 : 1);
                const possibleKatex = src.substring(index);

                if (inlineRule.test(possibleKatex))
                    return index;

                re.lastIndex = match.index + 1;
            }
        },
        tokenizer(src: string) {
            const match = src.match(inlineRule);
            if (match) {
                return {
                    type: 'inlineMath',
                    raw: match[0],
                    text: match[2].trim(),
                    displayMode: match[1].length === 2,
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
            let match: RegExpExecArray | null;
            const re = /(?:^|\n)\${2}/g;
            while ((match = re.exec(src)) !== null) {
                const index = match.index + (match[0].startsWith('\n') ? 1 : 0);
                const possibleBlock = src.substring(index);

                if (blockRule.test(possibleBlock))
                    return index;

                re.lastIndex = match.index + 1;
            }
        },
        tokenizer(src: string) {
            const match = src.match(blockRule);
            if (match) {
                const text = (match[2] ?? match[3] ?? '').trim();
                return {
                    type: 'multiplemath',
                    raw: match[0],
                    text,
                    displayMode: match[1].length === 2,
                    mathStyle: '',
                };
            }
        },
        renderer,
    };
}
