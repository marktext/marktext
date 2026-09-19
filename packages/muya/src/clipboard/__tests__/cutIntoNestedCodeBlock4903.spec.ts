// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// #4903 / #5148: a cross-block cut (paste, typing or Backspace over the
// selection) that ends inside a code, math or html block nested in a list item
// or quote, with more content after that block in the same container, must
// remove the block once. The json state then still matches the block tree and
// its flush does not throw.

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
    const muya = new MuyaClass(host, { markdown, texMathDollars: true } as ConstructorParameters<typeof MuyaClass>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function findContent(muya: Muya, blockName: string): Content {
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && block.blockName !== blockName)
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no ${blockName} in the document`);
    return block;
}

function treeState(muya: Muya): TState[] {
    const states: TState[] = [];
    muya.editor.scrollPage!.forEach(block => states.push((block as Parent).getState()));
    return states;
}

function stubSelection(muya: Muya, anchor: Content, anchorOffset: number, focus: Content, focusOffset: number) {
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
}

describe('cross-block cut into a nested code, math or html block (#4903, #5148)', () => {
    it.each([
        {
            kind: 'code block in a list item',
            markdown: 'intro\n\n- item\n\n  ```js\n  code\n  ```\n\n  tail\n',
            codeOffset: 2,
            expected: 'inde\n\n- tail\n',
        },
        {
            kind: 'math block in a quote',
            markdown: 'intro\n\n> quote\n>\n> $$\n> a+b\n> $$\n>\n> tail\n',
            codeOffset: 1,
            expected: 'in+b\n\n> tail\n',
        },
        {
            kind: 'html block in a list item',
            markdown: 'intro\n\n- item\n\n  <div>\n  hi\n  </div>\n\n  tail\n',
            codeOffset: 5,
            expected: 'in\nhi\n</div>\n\n- tail\n',
        },
    ])('removes the $kind once and keeps what follows it', ({ markdown, codeOffset, expected }) => {
        const muya = bootMuya(markdown);
        stubSelection(muya, findContent(muya, 'paragraph.content'), 2, findContent(muya, 'codeblock.content'), codeOffset);

        muya.editor.clipboard.cutHandler();

        expect(() => muya.editor.jsonState.flush()).not.toThrow();
        expect(muya.editor.jsonState.getState()).toEqual(treeState(muya));
        expect(muya.getMarkdown()).toBe(expected);
    });
});
