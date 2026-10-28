import { describe, expect, it } from 'vitest';
import { continuesList, formatListMarker, minSpacesAfterMarker, outlineLevel, parseListMarker, toListDelimiter } from '../listMarker';

describe('parseListMarker', () => {
    it('reads each delimiter', () => {
        expect(parseListMarker('3.')).toEqual({ value: 3, style: 'decimal', delimiter: '.' });
        expect(parseListMarker('3)')).toEqual({ value: 3, style: 'decimal', delimiter: ')' });
        expect(parseListMarker('(a)')).toEqual({ value: 1, style: 'lower-alpha', delimiter: '()' });
    });

    it('reads a first `i` or `I` as roman one and other single letters as alphabetic', () => {
        expect(parseListMarker('i.')).toEqual({ value: 1, style: 'lower-roman', delimiter: '.' });
        expect(parseListMarker('I)')).toEqual({ value: 1, style: 'upper-roman', delimiter: ')' });
        expect(parseListMarker('v.')).toEqual({ value: 22, style: 'lower-alpha', delimiter: '.' });
        expect(parseListMarker('C.')).toEqual({ value: 3, style: 'upper-alpha', delimiter: '.' });
    });

    it('reads letter runs as roman numerals', () => {
        expect(parseListMarker('IV.')).toEqual({ value: 4, style: 'upper-roman', delimiter: '.' });
        expect(parseListMarker('(xii)')).toEqual({ value: 12, style: 'lower-roman', delimiter: '()' });
        expect(parseListMarker('MCMXCIX.')?.value).toBe(1999);
        expect(parseListMarker('IIII.')?.value).toBe(4);
    });

    it('rejects text that is not a marker', () => {
        expect(parseListMarker('aa.')).toBeNull();
        expect(parseListMarker('IL.')).toBeNull();
        expect(parseListMarker('Iv.')).toBeNull();
        expect(parseListMarker('(a.')).toBeNull();
        expect(parseListMarker('a')).toBeNull();
        expect(parseListMarker('1234567890.')).toBeNull();
    });

    it('reads later items in the list style', () => {
        expect(parseListMarker('v.', 'lower-roman')).toEqual({ value: 5, style: 'lower-roman', delimiter: '.' });
        expect(parseListMarker('i.', 'lower-alpha')).toEqual({ value: 9, style: 'lower-alpha', delimiter: '.' });
        expect(parseListMarker('ii.', 'lower-alpha')).toBeNull();
        expect(parseListMarker('b.', 'decimal')).toBeNull();
    });

    it('reads `#` as one in any style, and digits after it', () => {
        expect(parseListMarker('#.')).toEqual({ value: 1, style: 'default', delimiter: '.' });
        expect(parseListMarker('(#)')).toEqual({ value: 1, style: 'default', delimiter: '()' });
        expect(parseListMarker('#)', 'lower-roman')).toEqual({ value: 1, style: 'lower-roman', delimiter: ')' });
        expect(parseListMarker('7.', 'default')).toEqual({ value: 7, style: 'default', delimiter: '.' });
        expect(parseListMarker('b.', 'default')).toBeNull();
        expect(parseListMarker('##.')).toBeNull();
    });
});

describe('formatListMarker', () => {
    it('writes each style and delimiter', () => {
        expect(formatListMarker({ value: 4, style: 'upper-roman', delimiter: '.' })).toBe('IV.');
        expect(formatListMarker({ value: 14, style: 'lower-roman', delimiter: ')' })).toBe('xiv)');
        expect(formatListMarker({ value: 2, style: 'upper-alpha', delimiter: '.' })).toBe('B.');
        expect(formatListMarker({ value: 3, style: 'lower-alpha', delimiter: '()' })).toBe('(c)');
        expect(formatListMarker({ value: 10, style: 'decimal', delimiter: '()' })).toBe('(10)');
        expect(formatListMarker({ value: 3, style: 'default', delimiter: '.' })).toBe('#.');
        expect(formatListMarker({ value: 3, style: 'default', delimiter: '()' })).toBe('(#)');
    });

    it('wraps alphabetic values past z', () => {
        expect(formatListMarker({ value: 26, style: 'lower-alpha', delimiter: '.' })).toBe('z.');
        expect(formatListMarker({ value: 27, style: 'lower-alpha', delimiter: '.' })).toBe('a.');
        expect(formatListMarker({ value: 28, style: 'upper-alpha', delimiter: ')' })).toBe('B)');
    });

    it('disambiguates single-letter Roman numerals only at the start of a list', () => {
        for (const value of [1, 4, 5, 10, 50, 100, 500, 1000]) {
            for (const style of ['lower-roman', 'upper-roman'] as const) {
                for (const delimiter of ['.', ')', '()'] as const) {
                    const marker = { value, style, delimiter };
                    expect(parseListMarker(formatListMarker(marker, 'first'))).toEqual(marker);
                    expect(parseListMarker(formatListMarker(marker), style)).toEqual(marker);
                }
            }
        }
        expect(formatListMarker({ value: 5, style: 'upper-roman', delimiter: '.' }, 'first')).toBe('IIIII.');
        expect(formatListMarker({ value: 5, style: 'upper-roman', delimiter: '.' })).toBe('V.');
        expect(formatListMarker({ value: 22, style: 'upper-alpha', delimiter: '.' }, 'first')).toBe('V.');
    });
});

describe('minSpacesAfterMarker', () => {
    it('disambiguates a page number only after a lower-alpha period marker', () => {
        expect(minSpacesAfterMarker(parseListMarker('p.')!, '5 items')).toBe(2);
        expect(minSpacesAfterMarker(parseListMarker('p.')!, 'items')).toBe(1);
        expect(minSpacesAfterMarker(parseListMarker('p)')!, '5 items')).toBe(1);
        expect(minSpacesAfterMarker(parseListMarker('(p)')!, '5 items')).toBe(1);
        expect(minSpacesAfterMarker({ value: 42, style: 'lower-alpha', delimiter: '.' }, '5 items')).toBe(2);
    });

    it('asks for two spaces after a period marker that reads like an initial', () => {
        const spaces = (text: string, style?: Parameters<typeof parseListMarker>[1]) => {
            const marker = parseListMarker(text, style);
            return marker && minSpacesAfterMarker(marker);
        };
        expect(spaces('I.')).toBe(2);
        expect(spaces('A.')).toBe(2);
        expect(spaces('V.', 'upper-roman')).toBe(2);
        expect(spaces('C.', 'upper-roman')).toBe(2);
        expect(spaces('II.')).toBe(1);
        expect(spaces('IV.')).toBe(1);
        expect(spaces('C)')).toBe(1);
        expect(spaces('(A)')).toBe(1);
        expect(spaces('a.')).toBe(1);
        expect(spaces('1.')).toBe(1);
        expect(spaces('#.')).toBe(1);
        expect(spaces('#.', 'upper-alpha')).toBe(2);
    });
});

describe('continuesList', () => {
    it('distinguishes overlapping alpha and roman markers by the first written value', () => {
        const alpha = { style: 'lower-alpha', delimiter: '.' } as const;
        expect(continuesList(alpha, { value: 1, style: 'lower-roman', delimiter: '.' })).toBe(true);
        expect(continuesList(alpha, { value: 2, style: 'lower-roman', delimiter: '.' })).toBe(false);
        expect(continuesList(alpha, { value: 5, style: 'lower-roman', delimiter: '.' })).toBe(false);
        expect(continuesList({ style: 'lower-roman', delimiter: '.' }, { value: 1, style: 'lower-alpha', delimiter: '.' })).toBe(false);
        expect(continuesList(alpha, { value: 1, style: 'upper-roman', delimiter: '.' }, '#.')).toBe(true);
    });

    it('continues a list with a `#` list unless pandoc wants two spaces after it', () => {
        expect(continuesList({ style: 'lower-alpha', delimiter: '.' }, { value: 1, style: 'default', delimiter: '.' })).toBe(true);
        expect(continuesList({ style: 'decimal', delimiter: ')' }, { value: 1, style: 'default', delimiter: ')' })).toBe(true);
        expect(continuesList({ style: 'upper-alpha', delimiter: '.' }, { value: 1, style: 'default', delimiter: '.' })).toBe(false);
        expect(continuesList({ style: 'lower-alpha', delimiter: '.' }, { value: 1, style: 'default', delimiter: ')' })).toBe(false);
    });

    it('continues a `#` list with digits only', () => {
        expect(continuesList({ style: 'default', delimiter: '.' }, { value: 1, style: 'decimal', delimiter: '.' })).toBe(true);
        expect(continuesList({ style: 'default', delimiter: '.' }, { value: 1, style: 'lower-alpha', delimiter: '.' })).toBe(false);
        expect(continuesList({ style: 'lower-roman', delimiter: '.' }, { value: 1, style: 'lower-roman', delimiter: '.' })).toBe(true);
        expect(continuesList({ style: 'lower-roman', delimiter: '.' }, { value: 1, style: 'decimal', delimiter: '.' })).toBe(false);
    });
});

describe('toListDelimiter', () => {
    it('keeps a known delimiter and falls back to a period', () => {
        expect(toListDelimiter(')')).toBe(')');
        expect(toListDelimiter('()')).toBe('()');
        expect(toListDelimiter('-')).toBe('.');
    });
});

describe('outlineLevel', () => {
    it('steps through the outline styles and stays on the last past the end', () => {
        expect(outlineLevel(0)).toEqual({ style: 'upper-roman', delimiter: '.' });
        expect(outlineLevel(2)).toEqual({ style: 'decimal', delimiter: '.' });
        expect(outlineLevel(5)).toEqual({ style: 'decimal', delimiter: '()' });
        expect(outlineLevel(9)).toEqual({ style: 'lower-alpha', delimiter: '()' });
    });
});
