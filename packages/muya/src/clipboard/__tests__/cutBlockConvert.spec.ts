// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// muyajs `cutHandler` runs `checkInlineUpdate` after a cut so the start block's
// type tracks its new text: cutting away a heading's `# ` marker demotes it to a
// paragraph, and cutting text so a paragraph starts with `# ` promotes it.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
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

function firstContent(muya: Muya): Content {
    return muya.editor.scrollPage!.firstContentInDescendant()!;
}

function stubSameBlockSelection(muya: Muya, block: Content, start: number, end: number) {
    // Capture `path` eagerly: the cut triggers a block-type conversion that
    // detaches `block`, and a re-entrant `getSelection` would otherwise read a
    // null parent off the stale node.
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: start, block, path },
        focus: { offset: end, block, path },
        isCollapsed: false,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
}

async function cut(muya: Muya): Promise<void> {
    muya.editor.clipboard.cutHandler();
    await new Promise(r => setTimeout(r, 40));
}

describe('track C — same-block cut re-evaluates block type', () => {
    it('cutting the "## " marker from a heading demotes it to a paragraph', async () => {
        const muya = bootMuya('## Heading\n');
        const block = firstContent(muya);
        stubSameBlockSelection(muya, block, 0, 3); // select "## "
        await cut(muya);

        expect(muya.editor.scrollPage!.firstChild!.blockName).toBe('paragraph');
        expect(muya.getMarkdown()).toBe('Heading\n');
    });

    it('cutting text so a paragraph starts with "# " promotes it to a heading', async () => {
        const muya = bootMuya('a# title\n');
        const block = firstContent(muya);
        stubSameBlockSelection(muya, block, 0, 1); // select "a"
        await cut(muya);

        expect(muya.editor.scrollPage!.firstChild!.blockName).toBe('atx-heading');
        expect(muya.getMarkdown()).toBe('# title\n');
    });
});
