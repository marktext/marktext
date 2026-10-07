// @vitest-environment happy-dom

import type { InlineDiffToken } from '../types';
import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { tokenizer } from '../lexer';

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

function first(src: string) {
    return tokenizer(src, { hasBeginRules: false, options: OPTIONS })[0] as InlineDiffToken;
}

describe('inline diff syntax — editor lexer', () => {
    it('matches the four paired delimiter forms', () => {
        for (const src of ['{+ add +}', '[+ add +]', '{- del -}', '[- del -]']) {
            const token = first(src);
            expect(token.type).toBe('inline_diff');
            expect(token.marker).toBe(src.slice(0, 2));
            expect(token.content).toBe(src.slice(2, -2));
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

    it('treats an empty or whitespace-only body as literal, like `**`', () => {
        expect(types('{++}')).toEqual(['text']);
        expect(types('[- -]')).toEqual(['text']);
        expect(types('{+ +}')).toEqual(['text']);
    });

    it('does not claim a code span', () => {
        expect(types('`{+ x +}`')).toEqual(['inline_code']);
    });

    it('does not span a line break', () => {
        expect(types('{+ a\nb +}', false)).not.toContain('inline_diff');
        expect(types('{+ a\nb +}')).not.toContain('inline_diff');
    });
});

describe('inline diff syntax — HTML export', () => {
    it('renders additions and deletions with the GitLab diff classes', () => {
        expect(getHighlightHtml('{+ add +}', { inlineDiff: true })).toBe(
            '<p><ins class="idiff addition"> add </ins></p>\n',
        );
        expect(getHighlightHtml('[- del -]', { inlineDiff: true })).toBe(
            '<p><del class="idiff deletion"> del </del></p>\n',
        );
    });

    it('keeps the tags literal when disabled', () => {
        expect(getHighlightHtml('{+ add +}', { inlineDiff: false })).toBe(
            '<p>{+ add +}</p>\n',
        );
    });

    it('renders the body literally, with no nested markdown', () => {
        expect(getHighlightHtml('{+ <b>x</b> +}', { inlineDiff: true })).toBe(
            '<p><ins class="idiff addition"> &lt;b&gt;x&lt;/b&gt; </ins></p>\n',
        );
        expect(getHighlightHtml('{+ **bold** +}', { inlineDiff: true })).toBe(
            '<p><ins class="idiff addition"> **bold** </ins></p>\n',
        );
    });

    it('does not match mixed tags or an empty body', () => {
        expect(getHighlightHtml('{+ add +]', { inlineDiff: true })).not.toContain('<ins');
        expect(getHighlightHtml('{++}', { inlineDiff: true })).not.toContain('<ins');
    });

    it('renders the square-bracket form without claiming it as a link', () => {
        expect(getHighlightHtml('[+ add +]', { inlineDiff: true })).toBe(
            '<p><ins class="idiff addition"> add </ins></p>\n',
        );
        expect(getHighlightHtml('[+ add +]', { inlineDiff: false })).toBe(
            '<p>[+ add +]</p>\n',
        );
    });

    it('applies the extension to clipboard HTML too', () => {
        expect(getClipBoardHtml('{+ add +} [- del -]', { inlineDiff: true })).toBe(
            '<p><ins class="idiff addition"> add </ins> <del class="idiff deletion"> del </del></p>\n',
        );
    });
});
