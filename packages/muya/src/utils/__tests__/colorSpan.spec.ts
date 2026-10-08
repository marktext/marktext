import { describe, expect, it } from 'vitest';
import {
    colorPropertyOf,
    colorSpanOpenTag,
    parseColorStyle,
    serializeColorStyle,
} from '../colorSpan';

describe('parseColorStyle', () => {
    it('reads the two colour declarations', () => {
        expect(parseColorStyle('color:#e64340')).toEqual({
            color: '#e64340',
            backgroundColor: null,
        });
        expect(parseColorStyle('background-color:#fde2e2')).toEqual({
            color: null,
            backgroundColor: '#fde2e2',
        });
    });

    it('reads both declarations in either order', () => {
        const expected = { color: '#e64340', backgroundColor: '#fde2e2' };
        expect(parseColorStyle('color:#e64340;background-color:#fde2e2')).toEqual(expected);
        expect(parseColorStyle('background-color:#fde2e2;color:#e64340')).toEqual(expected);
    });

    it('lowercases names and values, and tolerates whitespace', () => {
        expect(parseColorStyle(' Color : #E64340 ; ')).toEqual({
            color: '#e64340',
            backgroundColor: null,
        });
    });

    it('rejects non-colour spans so we never rewrite foreign markup', () => {
        expect(parseColorStyle('font-weight:700')).toBeNull();
        expect(parseColorStyle('color:red;font-weight:700')).toBeNull();
        expect(parseColorStyle('')).toBeNull();
        expect(parseColorStyle(null)).toBeNull();
        expect(parseColorStyle(undefined)).toBeNull();
    });
});

describe('serializeColorStyle', () => {
    it('emits the canonical order — color before background-color', () => {
        expect(
            serializeColorStyle({ color: '#e64340', backgroundColor: '#fde2e2' }),
        ).toBe('color:#e64340;background-color:#fde2e2');
    });

    it('omits absent declarations', () => {
        expect(serializeColorStyle({ color: '#e64340', backgroundColor: null })).toBe(
            'color:#e64340',
        );
        expect(serializeColorStyle({ color: null, backgroundColor: null })).toBe('');
    });
});

describe('colorSpanOpenTag', () => {
    it('round-trips through parseColorStyle', () => {
        const style = { color: '#3370ff', backgroundColor: '#e1eaff' };
        const tag = colorSpanOpenTag(style);
        expect(tag).toBe('<span style="color:#3370ff;background-color:#e1eaff">');

        const inner = tag.slice('<span style="'.length, -('">'.length));
        expect(parseColorStyle(inner)).toEqual(style);
    });
});

describe('colorPropertyOf', () => {
    it('maps the logical formats to their CSS declarations', () => {
        expect(colorPropertyOf('color')).toBe('color');
        expect(colorPropertyOf('bg_color')).toBe('background-color');
    });
});
