import { describe, expect, it } from 'vitest';
import { matchString } from '../search';

// With the regexp option off, the query is plain text. A brace pair must not
// turn into a quantifier.
describe('matchString — literal query with braces', () => {
    const options = { isCaseSensitive: false, isWholeWord: false, isRegexp: false };

    it('finds `a{2}` as written', () => {
        const matches = matchString('aa a{2}', 'a{2}', options);
        expect(matches.map(m => [m.index, m.match])).toEqual([[3, 'a{2}']]);
    });

    it('does not match `aa` for the query `a{2}`', () => {
        expect(matchString('aa', 'a{2}', options)).toEqual([]);
    });

    it('finds `x{1,3}` as written', () => {
        const matches = matchString('xxx x{1,3}', 'x{1,3}', options);
        expect(matches.map(m => [m.index, m.match])).toEqual([[4, 'x{1,3}']]);
    });

    it('finds a lone brace', () => {
        expect(matchString('f() { return }', '{', options).map(m => m.index)).toEqual([4]);
    });

    it('does not match `aa` for the query `a{2}` as a whole word', () => {
        const matches = matchString('aa a{2}', 'a{2}', { ...options, isWholeWord: true });
        expect(matches.map(m => m.match)).toEqual([]);
    });
});
