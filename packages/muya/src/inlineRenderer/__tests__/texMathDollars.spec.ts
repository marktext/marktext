// @vitest-environment happy-dom

import type { CodeEmojiMathToken } from '../types';
import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { tokenizer } from '../lexer';

// marktext/marktext#5446 task 1, fixing #2002 and #5243. The live editor and
// the marked-based import/export path tokenize `$` math independently, and the
// two disagreed about the same document: "Revenue rose from $13B to $24B."
// rendered as KaTeX while editing but stayed literal on export. Both now apply
// pandoc's `tex_math_dollars` constraints, so every row below has to hold on
// both sides at once — that agreement is the property under test.
const cases: Array<[markdown: string, formulas: string[]]> = [
    // A closing `$` followed by a digit is a currency amount, not a formula.
    ['Revenue rose from $13B to $24B.', []],
    ['It costs $5 and $10 total.', []],
    ['price is $20, tax $3.', []],
    ['$a$2', []],
    // The opening `$` needs a non-space to its right, the closing one a
    // non-space to its left.
    ['$ x$', []],
    ['$x $', []],
    // Only digits disqualify a closer, so a letter right after it is fine.
    ['$x+y$', ['$x+y$']],
    ['$1+1$', ['$1+1$']],
    ['$x$y', ['$x$']],
    ['a$x$', ['$x$']],
    ['word$E=mc^2$word', ['$E=mc^2$']],
    ['$y = \\$10000$', ['$y = \\$10000$']],
    // A rejected span must not swallow — or hide — a real formula behind it.
    ['a $13B to $24B and $x+y$ b', ['$x+y$']],
    // pandoc leaves display math unconstrained on all three counts.
    ['$$ E=MC^2 $$', ['$$ E=MC^2 $$']],
    ['$$a$$ $$b$$', ['$$a$$', '$$b$$']],
    ['$$x$y$$', ['$$x$y$$']],
    ['$$a$$2', ['$$a$$']],
];

function editorFormulas(src: string): string[] {
    return tokenizer(src)
        .filter((token): token is CodeEmojiMathToken => token.type === 'inline_math')
        .map(({ marker, content }) => `${marker}${content}${marker}`);
}

// Counts the spans this path handed to KaTeX, parseable or not: `$$x$y$$` is
// math that KaTeX then rejects, and the question here is only whether the
// tokenizer claimed it.
function exportedFormulaCount(src: string): number {
    return getHighlightHtml(src).match(/class="katex(?:-error)?"/g)?.length ?? 0;
}

describe('pandoc tex_math_dollars constraints (#5446)', () => {
    for (const [markdown, formulas] of cases) {
        const summary = formulas.length ? formulas.join(', ') : 'no math';

        it(`reads ${JSON.stringify(markdown)} as ${summary} in the editor`, () => {
            expect(editorFormulas(markdown)).toEqual(formulas);
        });

        it(`reads ${JSON.stringify(markdown)} as ${summary} on export`, () => {
            expect(exportedFormulaCount(markdown)).toBe(formulas.length);
        });
    }
});
