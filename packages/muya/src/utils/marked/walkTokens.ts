import type { Token } from 'marked';
import type { IMathToken } from './extensions/math';
import type { Heading, ILexOption } from './types';

function isHeadingToken(token: Token | Heading): token is Heading {
    return token.type === 'heading';
}

function isMathToken(token: Token | IMathToken): token is IMathToken {
    return token.type === 'code' && token.lang === 'math';
}

function walkTokens(options: ILexOption) {
    return (token: Token | Heading) => {
        const { texMathGfm } = options;
        if (isHeadingToken(token)) {
            const matches = /\n {0,3}(=+|-+)/.exec(token.raw);
            token.headingStyle = matches ? 'setext' : 'atx';
            token.marker = matches ? matches[1] : '';
        }

        if (token.type === 'code') {
            // Indented blocks cannot carry a language; mark fenced blocks only once across repeated walks.
            if (token.codeBlockStyle === 'indented')
                token.lang = '';
            else if (!token.codeBlockStyle && typeof token.lang === 'string')
                token.codeBlockStyle = 'fenced';
        }

        // ```` ```math ```` is the display half of `tex_math_gfm`, so it rides
        // that extension alone — the dollar syntax has no say in it (#5446).
        if (isMathToken(token) && texMathGfm) {
            token.type = 'multiplemath';
            token.mathStyle = 'gfm';
            token.displayMode = true;
            const codeFields = token as IMathToken & Partial<{ lang: unknown; codeBlockStyle: unknown }>;
            delete codeFields.lang;
            delete codeFields.codeBlockStyle;
        }
    };
}

export default walkTokens;
