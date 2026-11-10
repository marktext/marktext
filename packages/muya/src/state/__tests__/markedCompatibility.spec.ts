// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { getClipBoardHtml } from '../../utils/marked/getClipboardHtml';
import { getHighlightHtml } from '../../utils/marked/getHighlightHtml';
import { MarkdownToState } from '../markdownToState';
import StateToMarkdown from '../stateToMarkdown';

const BLOCK_ENDINGS = [
    ['heading', '- - # heading\noutside\n'],
    ['fenced code', '- - ```\n    code\n    ```\noutside\n'],
    ['quoted heading', '- > # heading\noutside\n'],
] as const;

describe.each([false, true])('marked compatibility with fancyLists=%s', (fancyLists) => {
    const options = { fancyLists };
    const parse = (markdown: string) => new MarkdownToState(options).generate(markdown);

    it.each(BLOCK_ENDINGS)('keeps text after a nested %s outside the list when saved and reopened', (_name, markdown) => {
        const states = parse(markdown);
        expect(states).toHaveLength(2);
        expect(states[0].name).toBe('bullet-list');
        expect(states[1]).toMatchObject({ name: 'paragraph', text: 'outside' });

        const saved = new StateToMarkdown({ listIndentation: 1 }).generate(states);
        expect(parse(saved)).toEqual(states);
    });

    it.each(['14. text', '*'])('keeps %s in the preceding list-item paragraph', (continuation) => {
        expect(parse(`- paragraph\n  ${continuation}\n`)).toMatchObject([{
            name: 'bullet-list',
            children: [{
                name: 'list-item',
                children: [{ name: 'paragraph', text: `paragraph\n${continuation}` }],
            }],
        }]);
    });

    it.each(['3. child', '007. child', '3) [ ] child', '-', '*', '+', '1.'])('preserves a nested %s after editing a tight list', (nested) => {
        const parent = parse(`- paragraph\n\n  ${nested}\n`).find(state => state.name === 'bullet-list')!;
        parent.meta.loose = false;

        for (const listIndentation of [1, 2, 3, 4, 'tab', 'dfm']) {
            const serializer = new StateToMarkdown({ listIndentation, fancyLists });
            const saved = serializer.generate([parent]);
            const reopened = parse(saved);
            expect(reopened).toMatchObject([{ name: 'bullet-list', children: parent.children }]);
            expect(serializer.generate(reopened)).toBe(saved);
        }
        expect(parent.meta.loose).toBe(false);
    });

    for (const [name, render] of [['clipboard', getClipBoardHtml], ['export', getHighlightHtml]] as const) {
        const bodyOf = (markdown: string) => new DOMParser().parseFromString(render(markdown, options), 'text/html').body;

        it.each(BLOCK_ENDINGS)(`${name}: keeps text after a nested %s outside the list`, (_name, markdown) => {
            const body = bodyOf(markdown);
            expect([...body.children].map(node => node.tagName)).toEqual(['UL', 'P']);
            expect(body.lastElementChild?.textContent).toBe('outside');
        });

        it.each(['14. text', '*'])(`${name}: keeps %s in the preceding list-item paragraph`, (continuation) => {
            const body = bodyOf(`- paragraph\n  ${continuation}\n`);
            expect(body.querySelectorAll('li')).toHaveLength(1);
            expect(body.querySelector('li')?.textContent).toBe(`paragraph\n${continuation}`);
        });

        it(`${name}: preserves hard breaks in image alternative text`, () => {
            expect(bodyOf('![foo  \nbar](image.png)').querySelector('img')?.getAttribute('alt')).toBe('foo\nbar');
        });
    }
});
