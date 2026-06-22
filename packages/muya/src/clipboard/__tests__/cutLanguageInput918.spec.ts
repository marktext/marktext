// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// #918: a cross-block cut whose selection starts inside a code fence's
// language-input line must collapse the start code block to a paragraph
// holding the merged text, rather than corrupting the code block (the old
// path spliced the merged text into the language identifier and left an
// inconsistent block tree).

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
    const out: Content[] = [];
    let c: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (c) {
        out.push(c);
        c = c.nextContentInContext() ?? null;
    }
    return out;
}

function stubSelection(muya: Muya, a: Content, aOff: number, f: Content, fOff: number) {
    // Capture paths eagerly — the cut detaches the start code block, and a
    // re-entrant getSelection would otherwise read a null parent off it.
    const aPath = a.path;
    const fPath = f.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: aOff, block: a, path: aPath },
        focus: { offset: fOff, block: f, path: fPath },
        isCollapsed: false,
        isSelectionInSameBlock: a === f,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
}

async function cutAndRead(muya: Muya): Promise<string> {
    muya.editor.clipboard.cutHandler();
    await new Promise(r => setTimeout(r, 40));
    return muya.getMarkdown();
}

describe('track C — cross-block cut starting in a code fence language line (#918)', () => {
    it('collapses the code block to a paragraph holding the merged text', async () => {
        const muya = bootMuya('```js\nconst x = 1\n```\n\nhello world\n');
        const blocks = contentBlocks(muya);
        const langInput = blocks.find(b => b.blockName === 'language-input')!;
        const para = blocks[blocks.length - 1];
        // 'js'@1 -> 'j' merged with 'hello world'@5 -> ' world'.
        stubSelection(muya, langInput, 1, para, 5);
        expect(await cutAndRead(muya)).toBe('j world\n');
    });
});
