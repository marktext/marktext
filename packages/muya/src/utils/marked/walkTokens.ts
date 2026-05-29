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
        const { math, isGitlabCompatibilityEnabled } = options;
        // marked mixes atx and setext headers, which we distinguish by headingStyle,
        // and markers are unique to setext heading
        if (isHeadingToken(token)) {
            const matches = /\n {0,3}(=+|-+)/.exec(token.raw);
            token.headingStyle = matches ? 'setext' : 'atx';
            token.marker = matches ? matches[1] : '';
        }

        if (token.type === 'code') {
            // Only strip the language tag for indented code blocks — those are
            // never fenced and can't carry a language. For fenced blocks we
            // tag them once; subsequent visits are no-ops, so this stays
            // idempotent even if walkTokens accidentally runs multiple times.
            if (token.codeBlockStyle === 'indented')
                token.lang = '';
            else if (!token.codeBlockStyle && typeof token.lang === 'string')
                token.codeBlockStyle = 'fenced';
        }

        if (isMathToken(token) && math && isGitlabCompatibilityEnabled) {
            // Transform the marked code-block token in place into the
            // multiplemath token shape that downstream consumers expect.
            // After the assignment the old `lang`/`codeBlockStyle` fields no
            // longer belong on the value, so strip them via a structural view.
            token.type = 'multiplemath';
            token.mathStyle = 'gitlab';
            token.displayMode = true;
            const codeFields = token as IMathToken & Partial<{ lang: unknown; codeBlockStyle: unknown }>;
            delete codeFields.lang;
            delete codeFields.codeBlockStyle;
        }
    };
}

export default walkTokens;
