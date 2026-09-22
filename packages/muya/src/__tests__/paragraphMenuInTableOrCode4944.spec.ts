// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { TState } from '../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// #4944 / #5012 / #5046 ("Cannot use numerical key for object container"): the
// paragraph commands resolved "the block at the cursor" as the caret leaf's
// parent. Inside a table cell that is the cell, inside a code, math, html,
// diagram or front matter block it is the inner code node, so a new block was
// inserted into a table row or into the code block and the json flush threw.
// Like muyajs, a table or code-like block is the block at the cursor there: a
// paragraph or table is inserted around it, and it is never converted.

vi.mock('../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedMuyas: Muya[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, texMathDollars: true, frontMatter: true } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

function placeCaret(muya: Muya, blockName: string, text: string): Content {
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && !(block.blockName === blockName && block.text === text))
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no ${blockName} with text ${JSON.stringify(text)}`);
    block.setCursor(0, 0, true);
    return block;
}

function treeState(muya: Muya): TState[] {
    const states: TState[] = [];
    muya.editor.scrollPage!.forEach(block => states.push((block as Parent).getState()));
    return states;
}

function settle(muya: Muya): TState[] {
    expect(() => muya.editor.jsonState.flush()).not.toThrow();
    const state = muya.editor.jsonState.getState();
    expect(state).toEqual(treeState(muya));
    return state;
}

const TABLE = '| a | b |\n| --- | --- |\n|  | 2 |\n';
const CODE = '```js\ncode\n```\n';

describe('paragraph commands with the caret in a table or code-like block (#4944)', () => {
    it.each([
        { where: 'a table cell', markdown: TABLE, blockName: 'table.cell.content', text: '2', type: 'heading 1' },
        { where: 'an empty table cell', markdown: TABLE, blockName: 'table.cell.content', text: '', type: 'pre' },
        { where: 'a table cell', markdown: TABLE, blockName: 'table.cell.content', text: 'a', type: 'paragraph' },
        { where: 'code', markdown: CODE, blockName: 'codeblock.content', text: 'code', type: 'heading 1' },
        { where: 'code', markdown: CODE, blockName: 'codeblock.content', text: 'code', type: 'paragraph' },
        { where: 'an empty language input', markdown: '```\ncode\n```\n', blockName: 'language-input', text: '', type: 'heading 1' },
        { where: 'a math block', markdown: '$$\na+b\n$$\n', blockName: 'codeblock.content', text: 'a+b', type: 'ul-bullet' },
        { where: 'an html block', markdown: '<div>\nhi\n</div>\n', blockName: 'codeblock.content', text: '<div>\nhi\n</div>', type: 'hr' },
    ])('converting from $where to $type leaves the document unchanged', ({ markdown, blockName, text, type }) => {
        const muya = bootMuya(markdown);
        const before = settle(muya);
        placeCaret(muya, blockName, text);

        muya.updateParagraph(type);

        expect(settle(muya)).toEqual(before);
    });

    it('inserts a paragraph after the table, not into its row', () => {
        const muya = bootMuya(TABLE);
        placeCaret(muya, 'table.cell.content', '2');

        muya.insertParagraph('after');

        expect(settle(muya).map(block => block.name)).toEqual(['table', 'paragraph']);
    });

    it('inserts a paragraph before the code block, not into it', () => {
        const muya = bootMuya(CODE);
        placeCaret(muya, 'codeblock.content', 'code');

        muya.insertParagraph('before');

        expect(settle(muya).map(block => block.name)).toEqual(['paragraph', 'code-block']);
    });

    it('never inserts a paragraph before front matter', () => {
        const muya = bootMuya('---\ntitle: x\n---\n\nbody\n');
        placeCaret(muya, 'codeblock.content', 'title: x');

        muya.insertParagraph('before');
        expect(settle(muya).map(block => block.name)).toEqual(['frontmatter', 'paragraph']);

        muya.insertParagraph('after');
        expect(settle(muya).map(block => block.name)).toEqual(['frontmatter', 'paragraph', 'paragraph']);
    });

    it.each([
        { where: 'a table whose first cell is empty', markdown: '|  | b |\n| --- | --- |\n| 1 | 2 |\n', blockName: 'table.cell.content', text: '1', kept: 'table' },
        { where: 'a code block without a language', markdown: '```\ncode\n```\n', blockName: 'codeblock.content', text: 'code', kept: 'code-block' },
    ])('creates a table after $where and keeps it', ({ markdown, blockName, text, kept }) => {
        const muya = bootMuya(markdown);
        placeCaret(muya, blockName, text);

        muya.createTable({ rows: 2, columns: 2 });

        expect(settle(muya).map(block => block.name)).toEqual([kept, 'table']);
    });
});
