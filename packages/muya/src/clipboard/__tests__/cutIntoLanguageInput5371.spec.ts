// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// #5371: a cross-block cut that ends inside a code block's language line
// keeps that code block and its language input; only the selected start of
// the language goes. The rest of the language used to be merged into the
// start block (duplicating it) and the language input node was dropped.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

const bootedHosts: HTMLElement[] = [];
let hadVersion = false;
let originalVersion: string | undefined;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new MuyaClass(host, { markdown } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function contentBlocks(muya: Muya): Content[] {
    const blocks: Content[] = [];
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block) {
        blocks.push(block);
        block = block.nextContentInContext() ?? null;
    }
    return blocks;
}

function findContent(muya: Muya, blockName: string, text: string, nth = 0): Content {
    const block = contentBlocks(muya).filter(b => b.blockName === blockName && b.text.includes(text))[nth];
    if (!block)
        throw new Error(`no ${blockName} containing ${JSON.stringify(text)}`);
    return block;
}

function cut(muya: Muya, anchor: Content, anchorOffset: number, focus: Content, focusOffset: number): void {
    const anchorPath = anchor.path;
    const focusPath = focus.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: anchorOffset, block: anchor, path: anchorPath },
        focus: { offset: focusOffset, block: focus, path: focusPath },
        isCollapsed: false,
        isSelectionInSameBlock: false,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
    muya.editor.clipboard.cutHandler();
}

function settledState(muya: Muya): TState[] {
    muya.editor.jsonState.flush();
    const state = muya.editor.jsonState.getState();
    const tree: TState[] = [];
    muya.editor.scrollPage!.forEach(block => tree.push((block as Parent).getState()));
    expect(state).toEqual(tree);
    return state;
}

// Every code block still starts with its language input, holding its language.
function expectLanguageInputs(muya: Muya, languages: string[]): void {
    const inputs = contentBlocks(muya).filter(b => b.blockName === 'language-input');
    expect(inputs.map(input => input.text)).toEqual(languages);
    const codeBlocks = contentBlocks(muya).filter(b => b.blockName === 'codeblock.content').map(code => code.parent!.parent!);
    expect(codeBlocks.map(codeBlock => (codeBlock as Parent).firstContentInDescendant()?.blockName)).toEqual(languages.map(() => 'language-input'));
}

const paragraph = (text: string) => ({ name: 'paragraph', text });
const codeBlock = (lang: string, text: string) => ({ name: 'code-block', meta: { type: 'fenced', lang }, text });

describe('cross-block cut ending in a code block\'s language line (#5371)', () => {
    it('trims the selected start of the language and keeps the code block', () => {
        const muya = bootMuya('Intro paragraph\n\n```js\ncode\n```\n\nOutro\n');

        cut(muya, findContent(muya, 'paragraph.content', 'Intro'), 3, findContent(muya, 'language-input', 'js'), 1);

        expect(settledState(muya)).toEqual([paragraph('Int'), codeBlock('s', 'code'), paragraph('Outro')]);
        expectLanguageInputs(muya, ['s']);
    });

    it('removes the blocks before a nested code block and keeps its language', () => {
        const muya = bootMuya('intro\n\n- item\n\n  ```js\n  code\n  ```\n\n  tail\n');

        cut(muya, findContent(muya, 'paragraph.content', 'intro'), 2, findContent(muya, 'language-input', 'js'), 0);

        const [first, list] = settledState(muya) as [unknown, { name: string; children: Array<{ children: unknown[] }> }];
        expect(first).toEqual(paragraph('in'));
        expect(list.name).toBe('bullet-list');
        expect(list.children.map(item => item.children)).toEqual([[codeBlock('js', 'code'), paragraph('tail')]]);
        expectLanguageInputs(muya, ['js']);
    });

    it('clears the language when the whole language line is selected', () => {
        const muya = bootMuya('Intro\n\n```js\ncode\n```\n');

        cut(muya, findContent(muya, 'paragraph.content', 'Intro'), 5, findContent(muya, 'language-input', 'js'), 2);

        expect(settledState(muya)).toEqual([paragraph('Intro'), codeBlock('', 'code')]);
        expectLanguageInputs(muya, ['']);
    });

    it('from one language line into another: collapses the first code block and keeps the second', () => {
        const muya = bootMuya('```js\na\n```\n\nmid\n\n```py\nb\n```\n');

        cut(muya, findContent(muya, 'language-input', 'js'), 1, findContent(muya, 'language-input', 'py'), 1);

        expect(settledState(muya)).toEqual([paragraph('j'), codeBlock('y', 'b')]);
        expectLanguageInputs(muya, ['y']);
    });
});
