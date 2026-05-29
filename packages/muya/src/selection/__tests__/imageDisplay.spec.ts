import { describe, expect, it } from 'vitest';
import { isInlineImage, shouldShowImageResizeBar } from '../imageDisplay';

// Regression tests for marktext commit d26f5092 (#1335):
// "Feature: resize image and toggle inline and block image".
// When the user toggles an image to inline via the image toolbar, the
// resize bar must not appear — inline images flow with surrounding text
// and dragging their edges is meaningless. We assert the pure decision
// function in isolation so the rule is locked even if the call sites
// (selection click handler today) get refactored.

function tk(attrs: Record<string, string | null>): { attrs: Record<string, string | null> } {
    return { attrs };
}

describe('imageDisplay — inline vs block decision (marktext d26f5092)', () => {
    it('treats `data-align="inline"` as inline', () => {
        expect(isInlineImage(tk({ 'data-align': 'inline' }))).toBe(true);
    });

    it('treats absent `data-align` as block (default markdown image)', () => {
        expect(isInlineImage(tk({}))).toBe(false);
    });

    it.each([['left'], ['center'], ['right']])(
        'treats `data-align="%s"` as block',
        (alignment) => {
            expect(isInlineImage(tk({ 'data-align': alignment }))).toBe(false);
        },
    );

    it('treats `data-align=null` (parsed but empty) as block', () => {
        expect(isInlineImage(tk({ 'data-align': null }))).toBe(false);
    });
});

describe('shouldShowImageResizeBar', () => {
    it('returns false for inline images', () => {
        expect(shouldShowImageResizeBar(tk({ 'data-align': 'inline' }))).toBe(false);
    });

    it.each([[''], ['left'], ['center'], ['right']])(
        'returns true for block alignment `%s`',
        (alignment) => {
            const attrs: Record<string, string | null> = alignment === ''
                ? {}
                : { 'data-align': alignment };
            expect(shouldShowImageResizeBar(tk(attrs))).toBe(true);
        },
    );
});
