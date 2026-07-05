// Regression for #4770: a fenced code block's info string must survive a
// markdown -> state -> markdown round-trip. MarkText used only the first word
// of the info string as the language (for highlighting) and serialized just
// that word back, so `` ```{example, listing1-name} `` was rewritten to
// `` ```{example, `` on save — dropping everything after the first space.

import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function roundTrip(md: string): string {
    const states = new MarkdownToState().generate(md);
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

describe('#4770: fenced code block info string round-trip', () => {
    it('preserves a Pandoc/RMarkdown-style attribute info string', () => {
        const md = '```{example, listing1-name}\nlabel for code listing 1\n```\n';
        expect(roundTrip(md)).toContain('```{example, listing1-name}');
    });

    it('preserves a language followed by attributes', () => {
        const md = '```js title="app.js"\nconst a = 1\n```\n';
        expect(roundTrip(md)).toContain('```js title="app.js"');
    });

    it('leaves a plain single-word language unchanged (no regression)', () => {
        const out = roundTrip('```js\nconst a = 1\n```\n');
        expect(out).toContain('```js\n');
    });

    it('leaves a language-less fence unchanged (no regression)', () => {
        const out = roundTrip('```\nplain\n```\n');
        expect(out).toContain('```\n');
        expect(out).not.toContain('```undefined');
    });
});
