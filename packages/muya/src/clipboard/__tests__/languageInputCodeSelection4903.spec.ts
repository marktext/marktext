// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// #4903 / #5148: a selection running from a code fence's language line into
// that same block's code (e.g. Shift+ArrowDown in the language input) is cut
// by paste, typing or Backspace. The cut must leave the json state describing
// the same document as the block tree; otherwise later edits build ops for
// blocks the json state no longer has and its flush throws.

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

// Report a forward selection from `anchor` to `focus` until the cut collapses
// it; the paste that follows the cut must then read the caret the cut placed.
function selectUntilCut(muya: Muya, anchor: Content, anchorOffset: number, focus: Content, focusOffset: number) {
    const { selection, clipboard } = muya.editor;
    const anchorPath = anchor.path;
    const focusPath = focus.path;
    selection.getSelection = () => ({
        anchor: { offset: anchorOffset, block: anchor, path: anchorPath },
        focus: { offset: focusOffset, block: focus, path: focusPath },
        isCollapsed: false,
        isSelectionInSameBlock: false,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
    const cut = clipboard.cutHandler.bind(clipboard);
    clipboard.cutHandler = () => {
        cut();
        delete (selection as Partial<typeof selection>).getSelection;
    };
}

function pasteEvent(text: string) {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : ''), files: [], items: [] },
    } as unknown as ClipboardEvent;
}

describe('selection from a language line into its own code (#4903, #5148)', () => {
    it('cutting it keeps the blocks after the code block in the json state', () => {
        const muya = bootMuya('```js\nconst x = 1\n```\n\nhello world\n');
        selectUntilCut(muya, findContent(muya, 'language-input'), 1, findContent(muya, 'codeblock.content'), 3);

        muya.editor.clipboard.cutHandler();
        muya.editor.jsonState.flush();

        expect(muya.getMarkdown()).toBe('jst x = 1\n\nhello world\n');
        expect(muya.editor.jsonState.getState()).toEqual(treeState(muya));
    });

    it('cutting it when the code block is the last block does not break the json flush', () => {
        const muya = bootMuya('intro\n\n```js\nconst x = 1\n```\n');
        selectUntilCut(muya, findContent(muya, 'language-input'), 1, findContent(muya, 'codeblock.content'), 3);

        muya.editor.clipboard.cutHandler();

        expect(() => muya.editor.jsonState.flush()).not.toThrow();
        expect(muya.getMarkdown()).toBe('intro\n\njst x = 1\n');
        expect(muya.editor.jsonState.getState()).toEqual(treeState(muya));
    });

    it('pasting over it replaces the selection and keeps the json state in sync', async () => {
        const muya = bootMuya('```js\nconst x = 1\n```\n\nhello world\n');
        selectUntilCut(muya, findContent(muya, 'language-input'), 1, findContent(muya, 'codeblock.content'), 3);

        await muya.editor.clipboard.pasteHandler(pasteEvent('python'), 'python', '');
        muya.editor.jsonState.flush();

        expect(muya.getMarkdown()).toBe('jpythonst x = 1\n\nhello world\n');
        expect(muya.editor.jsonState.getState()).toEqual(treeState(muya));
    });
});
