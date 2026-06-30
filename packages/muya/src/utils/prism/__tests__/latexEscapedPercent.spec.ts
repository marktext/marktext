// @vitest-environment happy-dom
import { beforeAll, describe, expect, it } from 'vitest';
import prism, { loadLanguage, patchLatexEscapedPercent } from '../index';

function hasCommentToken(code: string): boolean {
    const tokens = prism.tokenize(code, prism.languages.latex);
    return tokens.some(
        t => typeof t === 'object' && (t as { type?: string }).type === 'comment',
    );
}

describe('latex escaped percent highlighting (#3037)', () => {
    beforeAll(async () => {
        await loadLanguage('latex');
        patchLatexEscapedPercent(prism);
    });

    it('does not treat `\\%` as the start of a comment', () => {
        expect(hasCommentToken('1\\%+2\\%=3\\%')).toBe(false);
    });

    it('still treats a bare `%` as a comment', () => {
        expect(hasCommentToken('100% done')).toBe(true);
    });

    it('still treats a line-leading `%` as a comment', () => {
        expect(hasCommentToken('%a real comment')).toBe(true);
    });
});
