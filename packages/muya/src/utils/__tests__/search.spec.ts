import type { IMatch } from '../../search/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildRegexValue, matchString } from '../search';

// A matching loop that never advances past a zero-width match calls `exec`
// forever. Cap the calls so such a regression fails fast instead of hanging
// the test runner.
function capRegExpExec() {
    let calls = 0;
    const exec = RegExp.prototype.exec;
    vi.spyOn(RegExp.prototype, 'exec').mockImplementation(function (this: RegExp, text: string) {
        if (++calls > 1000)
            throw new Error('RegExp#exec called more than 1000 times');

        return exec.call(this, text);
    });
}

// Defensive coverage for the search helpers migrated from marktext.
//
// `buildRegexValue` already lines up with marktext 4c517b16 ("fix: search
// group"): it skips literal `\$N`, honours `$0` as the full match and
// `$N` (N≥1) as the captured subgroups. Pin the contract here so the
// next refactor in `utils/search.ts` doesn't silently regress group
// expansion when users rely on regex replace.
function makeMatch(matchText: string, subMatches: (string | undefined)[]): IMatch {
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

    // The captured text comes from the document and is inserted as-is; it is
    // never a replacement pattern of its own.
    it('inserts a capture containing `$$` without collapsing it', () => {
        const value = buildRegexValue(makeMatch('$$100', ['$$100']), '**$1**');
        expect(value).toBe('**$$100**');
    });

    it('inserts a capture containing `$&` verbatim', () => {
        const value = buildRegexValue(makeMatch('$&', ['$&']), '`$1`');
        expect(value).toBe('`$&`');
    });

    it('does not expand a placeholder inside already inserted text', () => {
        const value = buildRegexValue(makeMatch('x', ['$2', 'B']), '$1$2');
        expect(value).toBe('$2B');
    });

    it('expands the real $1 and not an escaped one earlier in the value', () => {
        const value = buildRegexValue(makeMatch('foo', ['cap']), 'literal \\$1 then $1');
        expect(value).toBe('literal \\$1 then cap');
    });

    it('expands every occurrence of a repeated placeholder', () => {
        const value = buildRegexValue(makeMatch('foo', ['cap']), '$1-$1');
        expect(value).toBe('cap-cap');
    });

    it('expands a group that did not take part in the match to nothing', () => {
        const value = buildRegexValue(makeMatch('b', [undefined, 'b']), '[$1][$2]');
        expect(value).toBe('[][b]');
    });
});

// `matchString` is the search engine's lexer: it turns the user-facing
// search options (case sensitivity / whole word / regexp) into a global
// RegExp and returns matches shaped `{ match, subMatches, index }`.
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

describe('matchString — zero-width regexp matches', () => {
    beforeEach(capRegExpExec);
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('finds every word boundary once', () => {
        const matches = matchString('ab cd', '\\b', { isRegexp: true });
        expect(matches.map(m => m.index)).toEqual([0, 2, 3, 5]);
        expect(matches.every(m => m.match === '')).toBe(true);
    });

    it('finds every lookahead position once', () => {
        const matches = matchString('abcb', '(?=b)', { isRegexp: true });
        expect(matches.map(m => m.index)).toEqual([1, 3]);
    });

    it('never stops an empty match between the halves of an emoji', () => {
        // `\-` forces the non-Unicode fallback, where `(?:)` matches at every
        // code unit.
        const matches = matchString('\u{1F642}a', '\\-|(?:)', { isRegexp: true });
        expect(matches.map(m => m.index)).toEqual([0, 2, 3]);
    });
});

// Replacing half of a surrogate pair leaves a lone surrogate in the block text,
// which `ot-text-unicode` cannot encode: the next state flush throws
// "Invalid offset - splits unicode bytes".
describe('matchString — regexp matches keep surrogate pairs whole', () => {
    const SMILE = '\u{1F642}';

    it('matches an emoji as one character with `.`', () => {
        const matches = matchString(`abc${SMILE}`, '.', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual(['a', 'b', 'c', SMILE]);
        expect(matches.map(m => m.index)).toEqual([0, 1, 2, 3]);
    });

    it('matches an emoji as one character in a negated class', () => {
        const matches = matchString(`abc${SMILE}`, '[^a-z]', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual([SMILE]);
    });

    it('matches an emoji with a preceding character', () => {
        const matches = matchString(`abc${SMILE}`, 'c.', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual([`c${SMILE}`]);
    });

    it('still accepts a pattern that is only valid without the Unicode flag', () => {
        // An identity escape like `\-` is a SyntaxError in Unicode mode.
        const matches = matchString('a-b', '\\-', { isRegexp: true });
        expect(matches.map(m => m.index)).toEqual([1]);
    });

    it('takes the whole emoji for a half-pair match when the Unicode flag cannot be used', () => {
        const matches = matchString(`a-${SMILE}`, '\\-|.', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual(['a', '-', SMILE]);
    });
});

// One user-visible character — an emoji ZWJ sequence, a letter with a combining
// mark — is replaced as a unit, never piece by piece.
describe('matchString — grapheme clusters are one unit', () => {
    // 🧑‍🧑‍🧒‍🧒: 7 code points / 11 code units, one character on screen.
    const FAMILY = '\u{1F9D1}\u200D\u{1F9D1}\u200D\u{1F9D2}\u200D\u{1F9D2}';
    const PERSON = '\u{1F9D1}';
    const E_ACUTE = 'e\u0301';

    it('regexp `.` matches a ZWJ sequence as one character', () => {
        const matches = matchString(`${FAMILY}z`, '.', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual([FAMILY, 'z']);
        expect(matches.map(m => m.index)).toEqual([0, 11]);
    });

    it('regexp character class matches a ZWJ sequence as one character', () => {
        const matches = matchString(`${FAMILY}z`, '[^a-z]', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual([FAMILY]);
    });

    it('merges regexp matches that expand into the same character', () => {
        const matches = matchString(`${FAMILY}z`, '.{2}', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual([`${FAMILY}z`]);
    });

    it('regexp match on a base letter takes its combining mark', () => {
        const matches = matchString(E_ACUTE, 'e', { isRegexp: true });
        expect(matches.map(m => m.match)).toEqual([E_ACUTE]);
    });

    it('drops a zero-width regexp match inside a character', () => {
        expect(matchString(FAMILY, '(?=\\u200D)', { isRegexp: true })).toEqual([]);
    });

    it('literal search does not find a code point inside a ZWJ sequence', () => {
        const matches = matchString(`${FAMILY} ${PERSON}`, PERSON, {});
        expect(matches.map(m => m.index)).toEqual([12]);
    });

    it('literal search does not find a base letter that carries a combining mark', () => {
        const matches = matchString(`${E_ACUTE} e`, 'e', {});
        expect(matches.map(m => m.index)).toEqual([3]);
    });

    it('literal search finds the whole ZWJ sequence', () => {
        const matches = matchString(`a${FAMILY}`, FAMILY, {});
        expect(matches.map(m => m.index)).toEqual([1]);
    });
});
