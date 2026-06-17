import type { IMatch } from '../../search/types';
import { describe, expect, it } from 'vitest';
import { buildRegexValue, matchString } from '../search';

// Defensive coverage for the search helpers migrated from marktext.
//
// `buildRegexValue` already lines up with marktext 4c517b16 ("fix: search
// group"): it skips literal `\$N`, honours `$0` as the full match and
// `$N` (N≥1) as the captured subgroups. Pin the contract here so the
// next refactor in `utils/search.ts` doesn't silently regress group
// expansion when users rely on regex replace.
function makeMatch(matchText: string, subMatches: string[]): IMatch {
    return {
        // `buildRegexValue` only reads .match / .subMatches; the `block`
        // field is required by the IMatch type but never consulted here.
        block: null as unknown as IMatch['block'],
        start: 0,
        end: matchText.length,
        match: matchText,
        subMatches,
    };
}

describe('buildRegexValue — marktext 4c517b16 group expansion', () => {
    it('expands $0 to the full match', () => {
        const value = buildRegexValue(makeMatch('hello', []), '<<$0>>');
        expect(value).toBe('<<hello>>');
    });

    it('expands $1, $2… to the corresponding sub-matches', () => {
        const value = buildRegexValue(
            makeMatch('2026-05-20', ['2026', '05', '20']),
            '$3/$2/$1',
        );
        expect(value).toBe('20/05/2026');
    });

    it('leaves `\\$1` literal alone (escape with backslash)', () => {
        const value = buildRegexValue(makeMatch('foo', ['cap']), 'pre \\$1 post');
        // backslash is preserved verbatim — the regex `(?<!\\)\$\d`
        // guards against it.
        expect(value).toBe('pre \\$1 post');
    });

    it('leaves $N alone when N is out of range', () => {
        const value = buildRegexValue(makeMatch('foo', ['only']), '$1 / $2');
        expect(value).toBe('only / $2');
    });

    it('returns the value verbatim when there are no $N tokens', () => {
        const value = buildRegexValue(makeMatch('foo', ['x']), 'plain replacement');
        expect(value).toBe('plain replacement');
    });
});

// `matchString` is the search engine's lexer: it turns the user-facing
// search options (case sensitivity / whole word / regexp) into a global
// RegExp and returns the `execall` match shape `{ match, subMatches, index }`.
// Pin the option matrix so a refactor of the regex assembly in
// `utils/search.ts` can't silently change which substrings are found.
describe('matchString — search option matrix', () => {
    describe('isCaseSensitive', () => {
        it('matches every casing when false (3 matches, indices 0/4/8)', () => {
            const matches = matchString('Foo foo FOO', 'foo', { isCaseSensitive: false });
            expect(matches).toHaveLength(3);
            expect(matches.map(m => m.index)).toEqual([0, 4, 8]);
            expect(matches.map(m => m.match)).toEqual(['Foo', 'foo', 'FOO']);
        });

        it('matches only the exact-case occurrence when true (1 match at the lowercase foo)', () => {
            const matches = matchString('Foo foo FOO', 'foo', { isCaseSensitive: true });
            expect(matches).toHaveLength(1);
            expect(matches[0].index).toBe(4);
            expect(matches[0].match).toBe('foo');
        });
    });

    describe('isWholeWord', () => {
        it('matches every substring occurrence when false (3 matches)', () => {
            const matches = matchString('cat category scatter', 'cat', { isWholeWord: false });
            expect(matches).toHaveLength(3);
            expect(matches.map(m => m.index)).toEqual([0, 4, 14]);
        });

        it('matches only the standalone word when true (1 match)', () => {
            const matches = matchString('cat category scatter', 'cat', { isWholeWord: true });
            expect(matches).toHaveLength(1);
            expect(matches[0].index).toBe(0);
            expect(matches[0].match).toBe('cat');
        });

        it('combines isWholeWord with isCaseSensitive', () => {
            const matches = matchString('Cat cat scatter', 'cat', {
                isWholeWord: true,
                isCaseSensitive: true,
            });
            // 'Cat' (index 0) is excluded by case sensitivity, 'scatter' by the
            // word boundary — only the standalone lowercase 'cat' survives.
            expect(matches).toHaveLength(1);
            expect(matches[0].index).toBe(4);
            expect(matches[0].match).toBe('cat');
        });
    });

    describe('isRegexp', () => {
        it('treats the value as a RegExp when true', () => {
            const matches = matchString('2026-05-20', '\\d{4}', { isRegexp: true });
            expect(matches).toHaveLength(1);
            expect(matches[0].match).toBe('2026');
            expect(matches[0].index).toBe(0);
        });

        it('returns [] for an invalid pattern instead of throwing', () => {
            // A bare '(' is an invalid RegExp; matchString swallows the
            // SyntaxError and returns an empty result.
            expect(() => matchString('abc', '(', { isRegexp: true })).not.toThrow();
            expect(matchString('abc', '(', { isRegexp: true })).toEqual([]);
        });

        it('populates subMatches from capture groups', () => {
            const matches = matchString('2026-05-20', '(\\d{2})-(\\d{2})', { isRegexp: true });
            expect(matches).toHaveLength(1);
            expect(matches[0].match).toBe('26-05');
            expect(matches[0].index).toBe(2);
            expect(matches[0].subMatches).toEqual(['26', '05']);
        });
    });
});
