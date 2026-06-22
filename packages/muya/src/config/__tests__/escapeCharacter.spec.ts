import { describe, expect, it } from 'vitest';
import escapeCharactersMap from '../escapeCharacter';

// marktext #3840: the `&nbsp;` entries in the character table stored U+0020
// (a regular space) instead of U+00A0 (the non-breaking space), so a `&nbsp;`
// in the document was treated as an ordinary space (wrong width / a wrap could
// occur across it). The other space entities were already correct.
describe('escapeCharactersMap — space entity code points (#3840)', () => {
    it('&nbsp; maps to U+00A0 (non-breaking space), not U+0020', () => {
        expect(escapeCharactersMap['&nbsp;'].codePointAt(0)).toBe(0x00A0);
    });

    it('&ensp; maps to U+2002 (en space)', () => {
        expect(escapeCharactersMap['&ensp;'].codePointAt(0)).toBe(0x2002);
    });

    it('&emsp; maps to U+2003 (em space)', () => {
        expect(escapeCharactersMap['&emsp;'].codePointAt(0)).toBe(0x2003);
    });
});
