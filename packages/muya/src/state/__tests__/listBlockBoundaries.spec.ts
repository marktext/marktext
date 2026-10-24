import type { IBulletListState, ICodeBlockState, TState } from '../types';
import { describe, expect, it } from 'vitest';
import { MarkdownToState } from '../markdownToState';
import ExportMarkdown from '../stateToMarkdown';

function parse(markdown: string, footnote = false) {
    return new MarkdownToState({
        footnote,
        texMathDollars: false,
        texMathGfm: false,
        frontMatter: false,
    }).generate(markdown);
}

function serialize(states: TState[]) {
    return new ExportMarkdown({ listIndentation: 1 }).generate(states);
}

describe('list block boundaries', () => {
    it.each([
        ['commonmark 321 / gfm 301', '- a\n  > b\n  ```\n  c\n  ```\n- d\n'],
        ['quote followed by heading', '- a\n  > b\n  ## c\n- d\n'],
        ['quote followed by thematic break', '- a\n  > b\n  ---\n- c\n'],
        ['thematic break followed by paragraph', '- a\n  ***\n  b\n- c\n'],
        ['html comment after paragraph', '- a\n  <!-- x -->\n- b\n'],
        ['html comment followed by paragraph', '- <!-- x -->\n  body\n- b\n'],
        ['html script after paragraph', '- a\n  <script>\n  x\n  </script>\n- b\n'],
        ['html type 6 after paragraph', '- a\n  <div>\n  x\n  </div>\n- b\n'],
        ['html comment after quote', '- > a\n  <!-- x -->\n- b\n'],
        ['task item', '- [ ] a\n  ```\n  x\n  ```\n- [x] b\n'],
        ['ordered task item', '1. [ ] a\n   ```\n   x\n   ```\n2. [x] b\n'],
        ['quote container', '> - a\n>   ```\n>   x\n>   ```\n> - b\n'],
        ['nested list', '- outer\n  - a\n    ```\n    x\n    ```\n  - b\n- next\n'],
        ['loose parent', '- outer\n\n  - a\n    ```\n    x\n    ```\n  - b\n\n- next\n'],
    ])('preserves structure and tightness: %s', (_name, markdown) => {
        const before = parse(markdown);
        const output = serialize(before);
        const after = parse(output);

        expect(output).toBe(markdown);
        expect(after).toEqual(before);
        expect(serialize(after)).toBe(output);
    });

    it('keeps a tight list inside a footnote body tight', () => {
        const markdown = '[^a]:\n    - a\n      ```\n      x\n      ```\n    - b\n';
        const before = parse(markdown, true);
        const output = serialize(before);
        expect(parse(output, true)).toEqual(before);
        expect(serialize(parse(output, true))).toBe(output);
    });

    it.each([
        ['type 6 HTML', '<div>\nx\n</div>'],
        ['type 7 HTML', '<x-widget>\nx\n</x-widget>'],
    ])('keeps a paragraph after %s outside the HTML block', (_name, html) => {
        const state: IBulletListState = {
            name: 'bullet-list',
            meta: { marker: '-', loose: false },
            children: [{
                name: 'list-item',
                children: [{ name: 'html-block', text: html }, { name: 'paragraph', text: 'body' }],
            }],
        };

        const list = parse(serialize([state]))[0] as IBulletListState;
        expect(list.children[0].children).toEqual(state.children[0].children);
        expect(list.meta.loose).toBe(true);
    });

    it.each([
        '<x-widget>',
        '<STYLE>\nx\n</STYLE>',
    ])('keeps edited HTML separate from a paragraph: %s', (html) => {
        const state: IBulletListState = {
            name: 'bullet-list',
            meta: { marker: '-', loose: false },
            children: [{
                name: 'list-item',
                children: [{ name: 'paragraph', text: 'body' }, { name: 'html-block', text: html }],
            }],
        };

        const list = parse(serialize([state]))[0] as IBulletListState;
        expect(list.children[0].children).toEqual(state.children[0].children);
    });

    it('does not pull an unprefixed paragraph into a blockquote', () => {
        const state: IBulletListState = {
            name: 'bullet-list',
            meta: { marker: '-', loose: false },
            children: [{
                name: 'list-item',
                children: [
                    { name: 'block-quote', children: [{ name: 'paragraph', text: 'quoted' }] },
                    { name: 'paragraph', text: 'outside' },
                ],
            }],
        };

        const list = parse(serialize([state]))[0] as IBulletListState;
        expect(list.children[0].children).toEqual(state.children[0].children);
    });

    it.each(['top level', 'tight item', 'loose item'])(
        'keeps two indented code blocks distinct at %s without mutating state',
        (context) => {
            const code = (text: string): ICodeBlockState => ({
                name: 'code-block',
                meta: { lang: '' },
                syntax: { form: 'indented', prefixes: text.split('\n').map(() => ({ raw: '    ', remainder: 0 })) },
                text,
            });
            const children = [code('a'), code('b\n```\nc')];
            const states: TState[] = context === 'top level'
                ? children
                : [{
                        name: 'bullet-list',
                        meta: { marker: '-', loose: context === 'loose item' },
                        children: [{ name: 'list-item', children }],
                    }];
            const snapshot = structuredClone(states);
            const output = serialize(states);
            const after = parse(output);
            const blocks = context === 'top level'
                ? after
                : (after[0] as IBulletListState).children[0].children;

            expect(blocks.map(block => block.name)).toEqual(['code-block', 'code-block']);
            expect(blocks.map(block => (block as ICodeBlockState).text)).toEqual(children.map(block => block.text));
            expect(states).toEqual(snapshot);
            expect(serialize(after)).toBe(output);
        },
    );
});
