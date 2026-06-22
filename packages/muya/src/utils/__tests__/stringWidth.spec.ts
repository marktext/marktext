import { describe, expect, it } from 'vitest';
import stringWidth from '../stringWidth';

// `stringWidth` returns the number of monospace columns a string occupies, used
// by the markdown table serializer to align columns (#1983). It must count
// combining marks as zero width and East-Asian wide / fullwidth code points as
// two, rather than counting UTF-16 code units like String.prototype.length.

describe('stringWidth', () => {
    it('counts plain ASCII as one column per character', () => {
        expect(stringWidth('abc')).toBe(3);
        expect(stringWidth('')).toBe(0);
    });

    it('counts a combining diacritic as zero width (#1983 IPA case)', () => {
        // `aʊ̯x` = a, ʊ, COMBINING INVERTED BREVE BELOW (U+032F), x.
        // length is 4 code units but it occupies 3 columns.
        const ipa = 'aʊ̯x';
        expect(ipa.length).toBe(4);
        expect(stringWidth(ipa)).toBe(3);
        // and it must align with the other plain 3-column cell.
        expect(stringWidth('nɔx')).toBe(3);
    });

    it('counts East-Asian wide characters as two columns', () => {
        expect(stringWidth('中')).toBe(2);
        expect(stringWidth('中文')).toBe(4);
        expect(stringWidth('a中')).toBe(3);
    });

    it('counts fullwidth forms as two columns', () => {
        // U+FF21 FULLWIDTH LATIN CAPITAL LETTER A
        expect(stringWidth('Ａ')).toBe(2);
    });

    it('counts zero-width formatting characters as zero', () => {
        expect(stringWidth('a​b')).toBe(2);
    });

    it('counts astral wide code points (CJK Ext B) by code point, not surrogate pair', () => {
        // U+20000 (𠀀) is a single wide ideograph encoded as a surrogate pair.
        const ext = '\u{20000}';
        expect(ext.length).toBe(2);
        expect(stringWidth(ext)).toBe(2);
    });
});
