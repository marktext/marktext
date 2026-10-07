// @vitest-environment happy-dom

import type { InlineDiffToken } from '../types';
import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { generator, tokenizer } from '../lexer';

const OPTIONS = {
    superSubScript: false,
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: false,
    inlineDiff: true,
};

function types(src: string, inlineDiff = true) {
    return tokenizer(src, {
        hasBeginRules: false,
        options: { ...OPTIONS, inlineDiff },
    }).map(token => token.type);
}

describe('inline diff syntax — editor lexer', () => {
    it('produces an `ins` token for the four addition forms', () => {
        for (const src of ['{+ add +}', '[+ add +]']) {
            const tokens = tokenizer(src, { hasBeginRules: false, options: OPTIONS });
            expect(tokens.map(token => token.type)).toEqual(['inline_diff']);
            const token = tokens[0] as InlineDiffToken;
            expect(token.kind).toBe('ins');
            expect(token.marker.startsWith(src[0])).toBe(true);
            expect(token.closer.endsWith(src.slice(-1))).toBe(true);
        }
    });

    it('produces a `del` token for the four deletion forms', () => {
        for (const src of ['{- del -}', '[- del -]']) {
            const tokens = tokenizer(src, { hasBeginRules: false, options: OPTIONS });
            expect(tokens.map(token => token.type)).toEqual(['inline_diff']);
            expect((tokens[0] as InlineDiffToken).kind).toBe('del');
        }
    });

    it('keeps `{+` / `[-` literal when inlineDiff is off', () => {
        expect(types('{+ hi +} and [- x -]', false)).toEqual(['text']);
    });

    it('rejects mixed wrapping tags, as GitLab does', () => {
        expect(types('{+ add +]')).toEqual(['text']);
        expect(types('[+ add +}')).toEqual(['text']);
        expect(types('{- del -]')).toEqual(['text']);
    });

    it('keeps a toggled span around while typing', () => {
        const tokens = tokenizer('a {+ add +} b', { hasBeginRules: false, options: OPTIONS });
        expect(tokens.map(token => token.type)).toEqual(['text', 'inline_diff', 'text']);
        expect((tokens[1] as InlineDiffToken).range).toEqual({ start: 2, end: 11 });
    });

    it('does not claim a code span', () => {
        expect(types('`{+ x +}`')).toEqual(['inline_code']);
    });

    it('keeps the body literal instead of parsing nested markdown', () => {
        const tokens = tokenizer('{+ **bold** +}', { hasBeginRules: false, options: OPTIONS });
        const token = tokens[0] as InlineDiffToken;

        expect(token.type).toBe('inline_diff');
        expect(token.children.map(child => child.type)).toEqual(['text']);
        expect(generator(tokens, true)).toBe('{+ **bold** +}');
    });

    it('does not span a line break', () => {
        // GitLab's filter is line-scoped (`.` never matches `\n`), so the
        // opener is left as literal text in both the on and off states.
        expect(types('{+ a\nb +}', false)).not.toContain('inline_diff');
        expect(types('{+ a\nb +}')).not.toContain('inline_diff');
    });
});

describe('inline diff syntax — HTML export', () => {
    it('renders additions and deletions as <ins> / <del> when enabled', () => {
        expect(getHighlightHtml('{+ add +}', { inlineDiff: true })).toBe(
            '<p><ins> add </ins></p>\n',
        );
        expect(getHighlightHtml('[- del -]', { inlineDiff: true })).toBe(
            '<p><del> del </del></p>\n',
        );
    });

    it('keeps the tags literal when disabled', () => {
        expect(getHighlightHtml('{+ add +}', { inlineDiff: false })).toBe(
            '<p>{+ add +}</p>\n',
        );
    });

    it('escapes the literal body instead of parsing it', () => {
        expect(getHighlightHtml('{+ <b>x</b> +}', { inlineDiff: true })).toBe(
            '<p><ins> &lt;b&gt;x&lt;/b&gt; </ins></p>\n',
        );
        expect(getHighlightHtml('{+ **bold** +}', { inlineDiff: true })).toBe(
            '<p><ins> **bold** </ins></p>\n',
        );
    });

    it('does not match the mixed wrapping tags', () => {
        expect(getHighlightHtml('{+ add +]', { inlineDiff: true })).not.toContain('<ins>');
    });

    it('renders the square-bracket form without claiming it as a link', () => {
        expect(getHighlightHtml('[+ add +]', { inlineDiff: true })).toBe(
            '<p><ins> add </ins></p>\n',
        );
        expect(getHighlightHtml('[+ add +]', { inlineDiff: false })).toBe(
            '<p>[+ add +]</p>\n',
        );
    });

    it('applies the extension to clipboard HTML too', () => {
        expect(getClipBoardHtml('{+ add +} [- del -]', { inlineDiff: true })).toBe(
            '<p><ins> add </ins> <del> del </del></p>\n',
        );
    });
});
