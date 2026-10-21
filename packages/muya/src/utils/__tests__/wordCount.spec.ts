import { describe, expect, it } from 'vitest';
import { wordCount } from '../index';

describe('wordCount', () => {
    it('counts plain ASCII words', () => {
        expect(wordCount('hello world')).toEqual({
            word: 2,
            character: 10,
            paragraph: 1,
            all: 11,
        });
    });

    it('counts each CJK character as its own word', () => {
        const result = wordCount('你好 world');
        expect(result.word).toBe(3);
        expect(result.character).toBe(7);
        expect(result.paragraph).toBe(1);
        expect(result.all).toBe(8);
    });

    it('splits paragraphs on blank lines', () => {
        const result = wordCount('a\n\nb\n\nc');
        expect(result.paragraph).toBe(3);
        expect(result.word).toBe(3);
        expect(result.character).toBe(3);
        expect(result.all).toBe(7);
    });

    it('returns all zeros for the empty string', () => {
        expect(wordCount('')).toEqual({
            word: 0,
            character: 0,
            paragraph: 0,
            all: 0,
        });
    });
});
