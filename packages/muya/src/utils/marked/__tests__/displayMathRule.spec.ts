import { describe, expect, it } from 'vitest';
import { getHighlightHtml } from '../getHighlightHtml';

// The HTML export must pick display versus inline `$$` math the same way the
// editor does: display only when the paragraph holds nothing but `$$` formulas.
const cases: Array<[markdown: string, display: boolean[]]> = [
    ['$$a \\ne b$$', [true]],
    ['   $$a$$   ', [true]],
    ['$$a$$ $$b$$', [true, true]],
    ['$$a$$\n$$b$$', [true, true]],
    ['$$a$$  \n$$b$$', [true, true]],
    ['> $$a$$', [true]],
    ['> > $$a$$', [true]],
    ['- $$c$$', [true]],
    ['- item\n\n  $$c$$', [true]],
    ['1. $$d$$', [true]],
    ['- [ ] $$t$$', [true]],
    ['- a\n  - $$n$$', [true]],
    ['- > $$x$$', [true]],
    ['> - $$y$$', [true]],
    ['text $$a$$ text', [false]],
    ['$$a$$ text', [false]],
    ['text $$a$$', [false]],
    ['line one\n$$a$$\nline three', [false]],
    ['$x$ and $$x$$', [false, false]],
    ['- see $$c$$', [false]],
    ['# $$a$$', [false]],
    ['| h |\n| --- |\n| $$d$$ |', [false]],
];

function count(html: string, pattern: RegExp) {
    return html.match(pattern)?.length ?? 0;
}

describe('getHighlightHtml — display versus inline `$$` math', () => {
    for (const [markdown, display] of cases) {
        it(`exports ${JSON.stringify(markdown)} as ${display.map(d => (d ? 'display' : 'inline')).join(', ')} math`, () => {
            const html = getHighlightHtml(markdown);

            expect(count(html, /class="katex"/g)).toBe(display.length);
            expect(count(html, /class="katex-display"/g)).toBe(display.filter(Boolean).length);
        });
    }
});
