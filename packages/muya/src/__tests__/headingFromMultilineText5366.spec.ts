// @vitest-environment happy-dom

import type Parent from '../block/base/parent';
import type { TState } from '../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// #5366: an ATX heading is one line, so turning a block whose text has line
// breaks into one joins the lines with a space. The heading used to keep the
// newlines, and saving wrote only its first line.

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

function bootWithCaretInFirstBlock(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(3, 3, true);
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

describe('turning a multi-line block into an ATX heading keeps every line (#5366)', () => {
    it.each([
        { block: 'a paragraph with a line break', markdown: 'Line one\nline two\n\nafter\n', type: 'heading 1', expected: '# Line one line two' },
        { block: 'a paragraph with a line break', markdown: 'Line one\nline two\n\nafter\n', type: 'upgrade heading', expected: '###### Line one line two' },
        { block: 'a two-line setext heading', markdown: 'Line one\nline two\n---\n\nafter\n', type: 'upgrade heading', expected: '# Line one line two' },
        { block: 'a three-line paragraph', markdown: 'one\ntwo\nthree\n\nafter\n', type: 'heading 3', expected: '### one two three' },
    ])('$type on $block', ({ markdown, type, expected }) => {
        const muya = bootWithCaretInFirstBlock(markdown);

        muya.updateParagraph(type);

        const [heading] = settledState(muya) as Array<{ name: string; text: string }>;
        expect(heading.name).toBe('atx-heading');
        expect(heading.text).toBe(expected);
        expect(muya.getMarkdown()).toBe(`${expected}\n\nafter\n`);
    });
});
