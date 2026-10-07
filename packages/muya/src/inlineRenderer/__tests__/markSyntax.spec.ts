// @vitest-environment happy-dom

import type { MarkToken } from '../types';
import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { generator, tokenizer } from '../lexer';

// `==text==` highlight (marktext/marktext#2552). The extension is off by
// default; when on, the editor lexer, the HTML/PDF export path and the
// clipboard HTML path must all agree that `==…==` is a `<mark>` span. The
// editor token is typed `mark` (not `highlight`) so it maps onto the existing
// Highlight format button/menu, which keys off `mark`.

const OPTIONS = {
    superSubScript: false,
    footnote: false,
    texMathDollars: false,
    texMathGfm: false,
    texMathSingleBackslash: false,
    texMathDoubleBackslash: false,
    highlightSyntax: true,
};

function types(src: string, highlightSyntax = true) {
    return tokenizer(src, {
        hasBeginRules: false,
        options: { ...OPTIONS, highlightSyntax },
    }).map(token => token.type);
}

describe('mark syntax — editor lexer', () => {
    it('produces a `mark` token when highlightSyntax is on', () => {
        const tokens = tokenizer('a ==hi== b', {
            hasBeginRules: false,
            options: OPTIONS,
        });

        expect(tokens.map(token => token.type)).toEqual(['text', 'mark', 'text']);
        const mark = tokens[1] as MarkToken;
        expect(mark.marker).toBe('==');
        expect(mark.range).toEqual({ start: 2, end: 8 });
    });

    it('leaves `==` as literal text when highlightSyntax is off', () => {
        expect(types('a ==hi== b', false)).toEqual(['text']);
    });

    it('parses inline markdown inside the span', () => {
        const tokens = tokenizer('==**bold** and `code`==', {
            hasBeginRules: false,
            options: OPTIONS,
        });
        const mark = tokens[0] as MarkToken;

        expect(mark.type).toBe('mark');
        expect(mark.children.map(child => child.type)).toEqual(['strong', 'text', 'inline_code']);
    });

    it('does not match empty, space-padded or unclosed runs', () => {
        expect(types('====')).toEqual(['text']);
        expect(types('a == b')).toEqual(['text']);
        expect(types('== x==')).toEqual(['text']);
        expect(types('==x==')).toEqual(['mark']);
    });

    it('does not claim a code span', () => {
        expect(types('`==x==`')).toEqual(['inline_code']);
    });

    it('keeps an even backslash run inside the span', () => {
        // Source `==a\\==`: `\\` escapes to a single visible backslash, and it
        // has to survive a source-preserving rebuild (`generator`).
        const src = '==a\\\\==';
        const tokens = tokenizer(src, { hasBeginRules: false, options: OPTIONS });
        const mark = tokens[0] as MarkToken;

        expect(tokens.map(token => token.type)).toEqual(['mark']);
        expect(mark.backlash).toBe('\\\\');
        expect(generator(tokens, true)).toBe(src);
    });

    it('treats an odd backslash run as an escaped closer (literal text)', () => {
        // Source `==a\==`: the lone `\` escapes the closer, so no highlight.
        expect(types('==a\\==')).toEqual(['text']);
    });
});

describe('mark syntax — HTML export', () => {
    it('renders ==…== as <mark> when enabled', () => {
        expect(getHighlightHtml('a ==hi== b', { highlightSyntax: true })).toBe(
            '<p>a <mark>hi</mark> b</p>\n',
        );
    });

    it('keeps ==…== literal when disabled', () => {
        expect(getHighlightHtml('a ==hi== b', { highlightSyntax: false })).toBe(
            '<p>a ==hi== b</p>\n',
        );
    });

    it('parses inline markdown inside the exported <mark>', () => {
        expect(getHighlightHtml('==**bold**==', { highlightSyntax: true })).toBe(
            '<p><mark><strong>bold</strong></mark></p>\n',
        );
    });

    it('applies the extension to clipboard HTML too', () => {
        expect(getClipBoardHtml('==hi==', { highlightSyntax: true })).toBe(
            '<p><mark>hi</mark></p>\n',
        );
    });

    it('renders the escaped backslash inside <mark> for an even run', () => {
        // `\\` is one literal backslash once escaped, matching the editor.
        expect(getHighlightHtml('==a\\\\==', { highlightSyntax: true })).toBe(
            '<p><mark>a\\</mark></p>\n',
        );
    });

    it('leaves an oddly-escaped closer as literal text, as the editor does', () => {
        const html = getHighlightHtml('==a\\==', { highlightSyntax: true });
        expect(html).not.toContain('<mark>');
    });
});
