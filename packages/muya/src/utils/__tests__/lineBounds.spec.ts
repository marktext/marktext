import { describe, expect, it } from 'vitest';
import { lineBounds } from '..';

describe('lineBounds', () => {
    it.each([
        { name: 'a single-line text', text: 'alpha beta', offset: 4, expected: [0, 10] },
        { name: 'the start of a single-line text', text: 'alpha beta', offset: 0, expected: [0, 10] },
        { name: 'the end of a single-line text', text: 'alpha beta', offset: 10, expected: [0, 10] },
        { name: 'the first line of three', text: 'one\ntwo\nthree', offset: 1, expected: [0, 3] },
        { name: 'the middle line of three, ending at its own newline', text: 'one\ntwo\nthree', offset: 5, expected: [4, 7] },
        { name: 'the last line of three', text: 'one\ntwo\nthree', offset: 9, expected: [8, 13] },
        { name: 'a newline itself', text: 'one\ntwo', offset: 3, expected: [0, 3] },
        { name: 'the character after a newline', text: 'one\ntwo', offset: 4, expected: [4, 7] },
        { name: 'an empty line between two others', text: 'one\n\nthree', offset: 4, expected: [4, 4] },
        { name: 'an empty text', text: '', offset: 0, expected: [0, 0] },
    ])('bounds $name', ({ text, offset, expected }) => {
        expect(lineBounds(text, offset)).toEqual(expected);
    });
});
