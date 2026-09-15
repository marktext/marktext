// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// #5368: a cut that starts in the language line of a code block nested in a
// list item or quote collapses that code block into a paragraph, as #918 does
// at the top level. It used to replace the whole list or quote.

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

function findContent(muya: Muya, blockName: string, text: string): Content {
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && !(block.blockName === blockName && block.text.includes(text)))
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no ${blockName} containing ${JSON.stringify(text)}`);
    return block;
}

function cutFromLanguageInput(muya: Muya, languageOffset: number, end: { blockName: string; text: string; offset: number }): void {
    const anchor = findContent(muya, 'language-input', '');
    const focus = findContent(muya, end.blockName, end.text);
    const anchorPath = anchor.path;
    const focusPath = focus.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: languageOffset, block: anchor, path: anchorPath },
        focus: { offset: end.offset, block: focus, path: focusPath },
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

const paragraph = (text: string) => ({ name: 'paragraph', text });

describe('cut from the language line of a nested code block (#5368)', () => {
    it('keeps the list when the cut ends in the same code block', () => {
        const muya = bootMuya('- item one\n\n  ```js\n  const a = 1\n  ```\n\n- item two\n');

        cutFromLanguageInput(muya, 1, { blockName: 'codeblock.content', text: 'const', offset: 3 });

        const [list] = settledState(muya) as Array<{ name: string; children: Array<{ children: unknown[] }> }>;
        expect(list.name).toBe('bullet-list');
        expect(list.children.map(item => item.children)).toEqual([
            [paragraph('item one'), paragraph('jst a = 1')],
            [paragraph('item two')],
        ]);
    });

    it('keeps the quote when the cut ends in the same code block', () => {
        const muya = bootMuya('> quote\n>\n> ```js\n> code\n> ```\n>\n> tail\n');

        cutFromLanguageInput(muya, 0, { blockName: 'codeblock.content', text: 'code', offset: 2 });

        expect(settledState(muya)).toEqual([
            { name: 'block-quote', children: [paragraph('quote'), paragraph('de'), paragraph('tail')] },
        ]);
    });

    it('keeps the content before the code block when the cut ends after the list', () => {
        const muya = bootMuya('- item one\n\n  ```js\n  const a = 1\n  ```\n\n- item two\n\nafter\n');

        cutFromLanguageInput(muya, 1, { blockName: 'paragraph.content', text: 'after', offset: 2 });

        const [list] = settledState(muya) as Array<{ name: string; children: Array<{ children: unknown[] }> }>;
        expect(list.name).toBe('bullet-list');
        expect(list.children[0].children).toEqual([paragraph('item one'), paragraph('jter')]);
    });

    it('still collapses a top-level code block into a paragraph', () => {
        const muya = bootMuya('before\n\n```js\nconst a = 1\n```\n\nafter\n');

        cutFromLanguageInput(muya, 1, { blockName: 'codeblock.content', text: 'const', offset: 3 });

        expect(settledState(muya)).toEqual([paragraph('before'), paragraph('jst a = 1'), paragraph('after')]);
    });
});
