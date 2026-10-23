import { Lexer } from 'marked';

export interface IHtmlBlockBoundary {
    interruptsParagraph: boolean;
    endsWithoutBlankLine: boolean;
}

const PROBE = 'muya-block-boundary';

/** Derive HTML boundaries from the same grammar as import, including edited HTML. */
export function getHtmlBlockBoundary(html: string): IHtmlBlockBoundary {
    const before = Lexer.lex(`${PROBE}\n${html}\n`, { gfm: true });
    const after = Lexer.lex(`${html}\n${PROBE}\n`, { gfm: true });
    const last = after[after.length - 1];

    return {
        interruptsParagraph: before[0]?.type === 'paragraph'
            && before[0].text === PROBE
            && before[1]?.type === 'html',
        endsWithoutBlankLine: after[0]?.type === 'html'
            && last?.type === 'paragraph'
            && last.text === PROBE,
    };
}
