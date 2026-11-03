import { Marked } from 'marked';
import { describe, expect, it } from 'vitest';
import referenceDefinitionTabs from '../referenceDefinitionTabs';

describe('reference definition Tab compatibility (#5968)', () => {
    for (const gfm of [false, true]) {
        it(`preserves raw definitions and title tabs with gfm=${gfm}`, () => {
            const marked = new Marked({ gfm }, referenceDefinitionTabs());
            const definition = '[ref]:\t/target\t"a\ttitle"\t';
            const tokens = marked.lexer(`[link][ref]\n\n${definition}\n`);
            expect(tokens.find(token => token.type === 'def')?.raw).toBe(`${definition}\n`);
            expect(tokens.links.ref).toEqual({ href: '/target', title: 'a\ttitle' });
        });

        it(`accepts tabs around a destination without a title with gfm=${gfm}`, () => {
            const marked = new Marked({ gfm }, referenceDefinitionTabs());
            expect(marked.parse('[link][ref]\n\n[ref]:\t/target\t\n'))
                .toBe('<p><a href="/target">link</a></p>\n');
        });

        it(`keeps code, escaped definitions and malformed definitions literal with gfm=${gfm}`, () => {
            const marked = new Marked({ gfm }, referenceDefinitionTabs());
            for (const definition of [
                '    [ref]: /target\t"title"',
                '\\[ref]: /target\t"title"',
                '[ref]: /target\t"title" extra',
                '[ref]: /target\t"unterminated',
                '```\n[ref]: /target\t"title"\n```',
            ]) {
                const markdown = `[link][ref]\n\n${definition}\n`;
                expect(marked.lexer(markdown).links).toEqual({});
                expect(marked.parse(markdown)).toContain('[link][ref]');
            }
        });
    }
});
