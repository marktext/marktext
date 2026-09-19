// @vitest-environment happy-dom

import type Content from '../block/base/content';
import type Parent from '../block/base/parent';
import type { TState } from '../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// #5360: Promote / Demote Heading change the paragraph or heading that holds
// the caret. They used to act on the outermost block, so in a list or quote
// Promote replaced the whole list or quote with one heading, and Demote on a
// heading in a list item did nothing.

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

function placeCaret(muya: Muya, text: string, offset = 0): void {
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && block.text !== text)
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no content ${JSON.stringify(text)}`);
    block.setCursor(offset, offset, true);
}

function treeState(muya: Muya): TState[] {
    const states: TState[] = [];
    muya.editor.scrollPage!.forEach(block => states.push((block as Parent).getState()));
    return states;
}

function settledState(muya: Muya): TState[] {
    muya.editor.jsonState.flush();
    const state = muya.editor.jsonState.getState();
    expect(state).toEqual(treeState(muya));
    return state;
}

const heading = (level: number, text: string) => ({ name: 'atx-heading', meta: { level }, text: `${'#'.repeat(level)} ${text}` });
const paragraph = (text: string) => ({ name: 'paragraph', text });

describe('promote / demote heading act on the caret\'s paragraph or heading (#5360)', () => {
    it('promotes only the list item paragraph that holds the caret', () => {
        const muya = bootMuya('- item one\n- item two\n');
        placeCaret(muya, 'item two', 4);

        muya.updateParagraph('upgrade heading');

        const [list] = settledState(muya) as Array<{ name: string; children: Array<{ children: unknown[] }> }>;
        expect(list.name).toBe('bullet-list');
        expect(list.children.map(item => item.children)).toEqual([[paragraph('item one')], [heading(6, 'item two')]]);
        expect(muya.editor.selection.anchorBlock?.text).toBe('###### item two');
        expect(muya.editor.selection.anchor?.offset).toBe(11);
    });

    it('demotes a heading inside a list item', () => {
        const muya = bootMuya('- item one\n- ## item two\n');
        placeCaret(muya, '## item two');

        muya.updateParagraph('degrade heading');

        const [list] = settledState(muya) as Array<{ children: Array<{ children: unknown[] }> }>;
        expect(list.children.map(item => item.children)).toEqual([[paragraph('item one')], [heading(3, 'item two')]]);
    });

    it('promotes only the quote paragraph that holds the caret', () => {
        const muya = bootMuya('> quote line\n>\n> second\n');
        placeCaret(muya, 'second');

        muya.updateParagraph('upgrade heading');

        const [quote] = settledState(muya) as Array<{ name: string; children: unknown[] }>;
        expect(quote.name).toBe('block-quote');
        expect(quote.children).toEqual([paragraph('quote line'), heading(6, 'second')]);
    });

    it('promotes a nested list item without touching the outer list', () => {
        const muya = bootMuya('1. one\n2. two\n   - nested\n');
        placeCaret(muya, 'nested');

        muya.updateParagraph('upgrade heading');

        const [list] = settledState(muya) as Array<{ name: string; children: Array<{ children: Array<{ name: string; text?: string; children?: Array<{ children: unknown[] }> }> }> }>;
        expect(list.name).toBe('order-list');
        expect(list.children[0].children).toEqual([paragraph('one')]);
        const [secondParagraph, sublist] = list.children[1].children;
        expect(secondParagraph).toEqual(paragraph('two'));
        expect(sublist.children!.map(item => item.children)).toEqual([[heading(6, 'nested')]]);
    });

    it.each([
        { where: 'a table cell', markdown: '| a | b |\n| --- | --- |\n| 1 | 2 |\n', caret: '2' },
        { where: 'a code block', markdown: '```js\ncode\n```\n', caret: 'code' },
        { where: 'a math block', markdown: '$$\na+b\n$$\n', caret: 'a+b' },
        { where: 'front matter', markdown: '---\ntitle: x\n---\n\nbody\n', caret: 'title: x' },
    ])('leaves $where unchanged', ({ markdown, caret }) => {
        const muya = bootMuya(markdown);
        const before = settledState(muya);
        placeCaret(muya, caret);

        muya.updateParagraph('upgrade heading');
        muya.updateParagraph('degrade heading');

        expect(settledState(muya)).toEqual(before);
    });

    it.each([
        { markdown: 'text\n', caret: 'text', type: 'upgrade heading', expected: [heading(6, 'text')] },
        { markdown: '## Two\n', caret: '## Two', type: 'upgrade heading', expected: [heading(1, 'Two')] },
        { markdown: '###### Six\n', caret: '###### Six', type: 'degrade heading', expected: [paragraph('Six')] },
    ])('still changes a top-level block: $type on $caret', ({ markdown, caret, type, expected }) => {
        const muya = bootMuya(markdown);
        placeCaret(muya, caret);

        muya.updateParagraph(type);

        expect(settledState(muya)).toEqual(expected);
    });
});
