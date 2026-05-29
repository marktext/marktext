import type { IMatch } from '../../search/types';
import { describe, expect, it } from 'vitest';
import { buildRegexValue } from '../search';

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
