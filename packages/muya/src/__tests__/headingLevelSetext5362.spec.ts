// @vitest-environment happy-dom

import type Parent from '../block/base/parent';
import type { TState } from '../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// #5362: Promote / Demote Heading take a setext heading's level from its
// state, so `Title` / `---` promotes to `# Title` and demotes to `### Title`.
// Its level used to count as 0, as for a paragraph.

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

function bootWithCaretInTitle(markdown: string, offset: number): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(offset, offset, true);
    return muya;
}

function settledState(muya: Muya): TState[] {
    muya.editor.jsonState.flush();
    const state = muya.editor.jsonState.getState();
    const tree: TState[] = [];
    muya.editor.scrollPage!.forEach(block => tree.push((block as Parent).getState()));
    expect(state).toEqual(tree);
    return state;
}

const SETEXT_1 = 'Title\n===\n\nafter\n';
const SETEXT_2 = 'Title\n---\n\nafter\n';
const after = { name: 'paragraph', text: 'after' };

describe('promote / demote heading on a setext heading (#5362)', () => {
    it.each([
        { heading: 'level-2 setext', markdown: SETEXT_2, type: 'upgrade heading', level: 1 },
        { heading: 'level-2 setext', markdown: SETEXT_2, type: 'degrade heading', level: 3 },
        { heading: 'level-1 setext', markdown: SETEXT_1, type: 'degrade heading', level: 2 },
    ])('$type on a $heading heading gives level $level', ({ markdown, type, level }) => {
        const muya = bootWithCaretInTitle(markdown, 2);

        muya.updateParagraph(type);

        const title = `${'#'.repeat(level)} Title`;
        expect(settledState(muya)).toEqual([{ name: 'atx-heading', meta: { level }, text: title }, after]);
        expect(muya.editor.selection.anchorBlock?.text).toBe(title);
        expect(muya.editor.selection.anchor?.offset).toBe(level + 3);
    });

    it('leaves a level-1 setext heading unchanged on promote', () => {
        const muya = bootWithCaretInTitle(SETEXT_1, 2);
        const before = settledState(muya);

        muya.updateParagraph('upgrade heading');

        expect(settledState(muya)).toEqual(before);
    });
});
