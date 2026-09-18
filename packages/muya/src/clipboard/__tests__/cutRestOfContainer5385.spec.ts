// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// #5385: a cross-block cut that starts inside a list or quote removed the
// blocks between the two ends and the end side, but kept the selected blocks
// after the start inside its own list item, list or quote.

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
    while (block && !(block.blockName === blockName && block.text === text))
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no ${blockName} with text ${JSON.stringify(text)}`);
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

// The json state matches the block tree, and serializes to `markdown`.
function expectDocument(muya: Muya, markdown: string): void {
    muya.editor.jsonState.flush();
    const tree: TState[] = [];
    muya.editor.scrollPage!.forEach(block => tree.push((block as Parent).getState()));
    expect(muya.editor.jsonState.getState()).toEqual(tree);
    expect(muya.getMarkdown()).toBe(markdown);
}

const paragraph = (muya: Muya, text: string) => findContent(muya, 'paragraph.content', text);

describe('cross-block cut starting inside a list or quote (#5385)', () => {
    it('removes the rest of the list when the cut ends after it', () => {
        const muya = bootMuya('- a\n- b\n- c\n\ntail\n');

        cut(muya, paragraph(muya, 'a'), 1, paragraph(muya, 'tail'), 1);

        expectDocument(muya, '- aail\n');
    });

    it('removes the rest of a quote', () => {
        const muya = bootMuya('> a\n>\n> b\n\ntail\n');

        cut(muya, paragraph(muya, 'a'), 1, paragraph(muya, 'tail'), 1);

        expectDocument(muya, '> aail\n');
    });

    it('removes the rest of every list the start is nested in', () => {
        const muya = bootMuya('- a\n  - x\n  - y\n- b\n\ntail\n');

        cut(muya, paragraph(muya, 'x'), 1, paragraph(muya, 'tail'), 1);

        expectDocument(muya, '- a\n  - xail\n');
    });

    it('removes the blocks after the start inside its list item, code blocks included', () => {
        const muya = bootMuya('- a\n\n  more\n\n  ```js\n  code\n  ```\n\n- b\n\ntail\n');

        cut(muya, paragraph(muya, 'a'), 1, paragraph(muya, 'tail'), 1);

        expectDocument(muya, '- aail\n');
    });

    it('removes a sub-list the cut passes over inside one list', () => {
        const muya = bootMuya('- a\n  - nested\n- c\n');

        cut(muya, paragraph(muya, 'a'), 1, paragraph(muya, 'c'), 1);

        expectDocument(muya, '- a\n');
    });

    it('removes the rest of the list when the cut ends in another list', () => {
        const muya = bootMuya('- a\n- b\n\n1. x\n2. y\n');

        cut(muya, paragraph(muya, 'a'), 1, paragraph(muya, 'x'), 1);

        expectDocument(muya, '- a\n1. y\n');
    });

    it('removes the rest of the list after a cut from a nested language line (#918)', () => {
        const muya = bootMuya('- a\n\n  ```js\n  code\n  ```\n\n  more\n\n- b\n\ntail\n');

        cut(muya, findContent(muya, 'language-input', 'js'), 1, paragraph(muya, 'tail'), 1);

        expectDocument(muya, '- a\n\n  jail\n');
    });
});
