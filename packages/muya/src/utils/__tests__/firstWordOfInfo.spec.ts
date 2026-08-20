import { describe, expect, it } from 'vitest';
import { firstWordOfInfo } from '../index';

describe('firstWordOfInfo', () => {
    it('returns the whole word for a plain language', () => {
        expect(firstWordOfInfo('js')).toBe('js');
    });

    it('returns the first word for a language + attributes', () => {
        expect(firstWordOfInfo('js title="app.js"')).toBe('js');
    });

    it('returns the first token for a Pandoc-style attribute block', () => {
        expect(firstWordOfInfo('{example, listing1-name}')).toBe('{example,');
    });

    it('returns empty string for empty / whitespace info', () => {
        expect(firstWordOfInfo('')).toBe('');
        expect(firstWordOfInfo('   ')).toBe('');
    });
});
