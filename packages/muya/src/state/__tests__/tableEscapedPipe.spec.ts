// @vitest-environment happy-dom

// #4849: an escaped pipe inside a table cell's inline code (`` `\|` ``) was
// displayed with the backslash (`\|`) instead of the intended `|`. GFM escapes
// `|` in table cells with a backslash; after the table is parsed that escape is
// a literal `|`, so `` `\|` `` must render as <code>|</code> (as the HTML/PDF
// export already does). The stored cell text re-added the escape, which leaks
// into the editor's inline-code display (the backslash rule doesn't apply
// inside code). Serialization re-escapes on its own, so the round-trip is kept.

import { describe, expect, it } from 'vitest';
import { Muya } from '../../muya';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    return muya;
}

function codeTexts(muya: Muya): string[] {
    return [...muya.domNode!.querySelectorAll('td code')].map(c => c.textContent ?? '');
}

function roundTrip(md: string): string {
    const states = new MarkdownToState().generate(md);
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

const TABLE = [
    '| a | b |',
    '| --- | --- |',
    '| `\\|` | x |',
    '| `\\|\\|` | y |',
    '',
].join('\n');

describe('#4849: escaped pipe in a table cell', () => {
    it('renders `\\|` inside code as | (no backslash) in the editor', () => {
        const muya = boot(TABLE);
        expect(codeTexts(muya)).toEqual(['|', '||']);
    });

    it('keeps the table structure (2 columns, 3 rows)', () => {
        const muya = boot(TABLE);
        expect(muya.domNode!.querySelectorAll('tr').length).toBe(3);
        expect(muya.domNode!.querySelectorAll('tr')[2].querySelectorAll('td').length).toBe(2);
    });

    it('round-trips the escaped pipes back to `\\|` / `\\|\\|`', () => {
        const md = roundTrip(TABLE);
        expect(md).toContain('`\\|`');
        expect(md).toContain('`\\|\\|`');
    });

    it('round-trips an escaped pipe in plain cell text', () => {
        const md = roundTrip('| a | b |\n| --- | --- |\n| x \\| y | z |\n');
        expect(md).toContain('x \\| y');
    });
});
