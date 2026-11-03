// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../../../state/markdownToState';
import ExportMarkdown from '../../../state/stateToMarkdown';
import { getClipBoardHtml } from '../getClipboardHtml';
import { getHighlightHtml } from '../getHighlightHtml';

const options = {
    frontMatter: false,
    texMathDollars: false,
    superSubScript: false,
};

function parse(markdown: string) {
    return new MarkdownToState(options).generate(markdown);
}

function roundTrip(markdown: string) {
    const states = parse(markdown);
    const serialized = new ExportMarkdown({ listIndentation: 1 }).generate(states);
    expect(parse(serialized)).toEqual(states);
    return states;
}

describe('markdown parser compatibility', () => {
    it.each(['===', '---'])('preserves a Setext heading with trailing tabs: %s', (underline) => {
        const markdown = `Heading\n${underline}\t\n`;
        expect(roundTrip(markdown)).toEqual([{
            name: 'setext-heading',
            meta: { level: underline === '===' ? 1 : 2 },
            text: 'Heading',
            syntax: { underline: `${underline}\t` },
        }]);
    });

    it.each(['`', '~'])('keeps the other fence character inside a %s code block', (fence) => {
        const other = fence === '`' ? '~' : '`';
        const markdown = `${fence.repeat(3)}\na\n${other.repeat(3)}\nb\n${fence.repeat(3)}\n`;
        expect(roundTrip(markdown)).toMatchObject([{
            name: 'code-block',
            text: `a\n${other.repeat(3)}\nb`,
            meta: { type: 'fenced', fenceChar: fence },
        }]);
    });

    it.each(['-', '1.'])('preserves checked state and body after checkbox tabs: %s', (marker) => {
        const states = roundTrip(`${marker} [x]\tDone\n${marker} [ ]\tTodo\n`);
        expect(states).toMatchObject([{
            name: 'task-list',
            children: [
                { name: 'task-list-item', meta: { checked: true }, children: [{ name: 'paragraph', text: 'Done' }] },
                { name: 'task-list-item', meta: { checked: false }, children: [{ name: 'paragraph', text: 'Todo' }] },
            ],
        }]);
    });

    for (const [name, render] of [['clipboard', getClipBoardHtml], ['export', getHighlightHtml]] as const) {
        it(`${name}: renders headings with trailing underline tabs`, () => {
            expect(render('Heading\n===\t\n', options)).toBe('<h1>Heading</h1>\n');
        });

        it.each([false, true])(`${name}: renders tab-separated checkboxes with fancy lists=%s`, (fancyLists) => {
            const root = document.createElement('div');
            root.innerHTML = render('- [x]\tDone\n- [ ]\tTodo\n', { ...options, fancyLists });
            const checkboxes = root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
            expect([...checkboxes].map(input => input.checked)).toEqual([true, false]);
            expect([...root.querySelectorAll('li')].map(item => item.textContent?.trim())).toEqual(['Done', 'Todo']);
        });

        it(`${name}: requires a word boundary before www autolinks`, () => {
            expect(render('abcwww.example.com www.example.com', options)).toBe(
                '<p>abcwww.example.com <a href="http://www.example.com">www.example.com</a></p>\n',
            );
        });

        it(`${name}: normalizes reference label whitespace without changing the link text`, () => {
            expect(render('[a\t b]\n\n[a  b]: /target\n', options)).toBe('<p><a href="/target">a\t b</a></p>\n');
        });

        it(`${name}: retains escaped parentheses in link destinations`, () => {
            expect(render('[text](foo\\)bar)', options)).toBe('<p><a href="foo)bar">text</a></p>\n');
        });
    }
});
