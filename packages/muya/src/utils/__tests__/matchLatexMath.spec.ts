import { describe, expect, it } from 'vitest';
import { matchLatexDisplayBlock, matchLatexMath } from '../matchLatexMath';

describe('matchLatexMath — inline \\( ... \\)', () => {
    it('matches a simple inline formula', () => {
        const m = matchLatexMath('\\(E = mc^2\\)');
        expect(m).toMatchObject({
            text: 'E = mc^2',
            kind: 'inline',
            open: '\\(',
            close: '\\)',
        });
    });

    it('keeps LaTeX command backslashes inside the content', () => {
        const m = matchLatexMath('\\(x_i = \\frac{a_i}{b_i}\\)');
        expect(m?.text).toBe('x_i = \\frac{a_i}{b_i}');
    });

    it('does not treat \\\\( as an opener', () => {
        expect(matchLatexMath('\\\\(x\\)')).toBeNull();
    });

    it('does not treat \\\\[ as an opener', () => {
        expect(matchLatexMath('\\\\[x\\]')).toBeNull();
    });

    it('does not close on \\\\ ) (escaped backslash then paren)', () => {
        expect(matchLatexMath('\\(x\\\\)')).toBeNull();
    });

    it('does not match an empty span', () => {
        expect(matchLatexMath('\\(\\)')).toBeNull();
    });
});

describe('matchLatexMath — inline \\[ ... \\]', () => {
    it('matches display delimiters mid-string start', () => {
        const m = matchLatexMath('\\[E = mc^2\\]');
        expect(m).toMatchObject({
            text: 'E = mc^2',
            kind: 'display',
            open: '\\[',
            close: '\\]',
        });
    });
});

describe('matchLatexDisplayBlock', () => {
    it('matches a multiline display formula including the trailing newline', () => {
        const src = '\\[\nd_{\\text{fim a fim}} = N\\frac{L}{R}\n\\]\n';
        const m = matchLatexDisplayBlock(src);
        expect(m?.kind).toBe('display');
        expect(m?.text).toBe('d_{\\text{fim a fim}} = N\\frac{L}{R}');
        expect(m?.raw).toBe(src);
    });

    it('matches a single-line display formula that is the whole block', () => {
        const m = matchLatexDisplayBlock('\\[ E = mc^2 \\]\n');
        expect(m?.text).toBe('E = mc^2');
    });

    it('does not steal trailing prose on the same line', () => {
        expect(matchLatexDisplayBlock('\\[x\\] is not a block\n')).toBeNull();
    });

    it('accepts up to three spaces of indent', () => {
        const m = matchLatexDisplayBlock('   \\[x\\]\n');
        expect(m?.text).toBe('x');
    });
});
