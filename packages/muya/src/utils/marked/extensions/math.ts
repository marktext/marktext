import katex from 'katex';
import { matchLatexDisplayBlock, matchLatexMath } from '../../matchLatexMath';
import 'katex/dist/contrib/mhchem.mjs';

export interface IMathToken {
    type: 'inlineMath' | 'multiplemath';
    raw: string;
    text: string;
    displayMode: boolean;
    mathStyle?: '' | 'gitlab' | 'latex';
}

interface IOptions {
    throwOnError?: boolean;
    useKatexRender?: boolean;
}

const inlineStartRule = /(\s|^)\${1,2}(?!\$)/;
const inlineRule
    = /^(\${1,2})(?!\$)((?:\\.|[^\\\n])*?(?:\\.|[^\\\n$]))\1(?=[\s?!.,:]|$)/;
const blockRule = /^(\${1,2})\n((?:\\[\s\S]|[^\\])+?)\n\1[ \t]*(?:\n|$)/;
// `\[` / `\(` whose leading backslash is not itself escaped (`\\[` is a
// literal backslash plus `[`, not a math opener).
const latexInlineStartRule = /(?<!\\)\\(?:\(|\[)/;

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
        else if (type === 'inlineMath') {
            if (mathStyle === 'latex')
                return displayMode ? `\\[${text}\\]` : `\\(${text}\\)`;
            return `$${text}$`;
        }
        else {
            return `<pre class="multiple-math" data-math-style="${mathStyle}">${text}</pre>\n`;
        }
    };
}

function inlineKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'inlineMath',
        level: 'inline' as const,
        start(src: string) {
            return earliestInlineStart(src);
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
            const latex = matchLatexMath(src);
            if (latex) {
                return {
                    type: 'inlineMath',
                    raw: latex.raw,
                    text: latex.text.trim(),
                    displayMode: latex.kind === 'display',
                    mathStyle: 'latex',
                };
            }
        },
        renderer,
    };
}

function earliestInlineStart(src: string): number | undefined {
    const dollar = src.match(inlineStartRule);
    let dollarIndex: number | undefined;
    if (dollar) {
        const index = (dollar.index || 0) + dollar[1].length;
        if (inlineRule.test(src.substring(index)))
            dollarIndex = index;
    }

    const latex = latexInlineStartRule.exec(src);
    let latexIndex: number | undefined;
    if (latex && matchLatexMath(src.substring(latex.index)))
        latexIndex = latex.index;

    if (dollarIndex === undefined)
        return latexIndex;
    if (latexIndex === undefined)
        return dollarIndex;
    return Math.min(dollarIndex, latexIndex);
}

function blockKatex(renderer: (token: IMathToken) => string) {
    return {
        name: 'multiplemath',
        level: 'block' as const,
        start(src: string) {
            return earliestBlockStart(src);
        },
        tokenizer(src: string) {
            const latex = matchLatexDisplayBlock(src);
            if (latex) {
                return {
                    type: 'multiplemath',
                    raw: latex.raw,
                    text: latex.text,
                    displayMode: true,
                    mathStyle: 'latex',
                };
            }
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

function earliestBlockStart(src: string): number | undefined {
    if (matchLatexDisplayBlock(src) || blockRule.test(src))
        return 0;

    const dollar = src.indexOf('\n$');
    const latex = src.search(/\n {0,3}\\\[/);
    if (dollar < 0)
        return latex < 0 ? undefined : latex;
    if (latex < 0)
        return dollar;
    return Math.min(dollar, latex);
}
