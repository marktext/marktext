// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// muyajs `pasteCtrl` list MERGE: pasting a same-type, same-marker list into a
// list item merges the first pasted item inline into the current item, appends
// the remaining pasted items to the list, and reconciles loose/tight.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

vi.mock('../../utils/paste', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/paste')>();
    return { ...actual, normalizePastedHTML: async (html: string) => html };
});

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

function pasteEvent(text: string) {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : ''), files: [], items: [] },
    } as unknown as ClipboardEvent;
}

async function paste(muya: Muya, block: Content, start: number, end: number, text: string): Promise<string> {
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: start, block, path },
        focus: { offset: end, block, path },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
    await muya.editor.clipboard.pasteHandler(pasteEvent(text), text, '');
    await new Promise(r => setTimeout(r, 40));
    return muya.getMarkdown();
}

describe('paste — same-type list merges into the enclosing list (A5, muyajs parity)', () => {
    it('merges the first pasted item inline and appends the rest', async () => {
        const muya = bootMuya('- a\n');
        const block = contentBlocks(muya)[0]; // list-item paragraph 'a'
        expect(await paste(muya, block, 1, 1, '- x\n- y')).toBe('- ax\n- y\n');
    });

    it('reconciles tight + loose into a loose list', async () => {
        const muya = bootMuya('- a\n');
        const block = contentBlocks(muya)[0];
        // a loose pasted list (blank line between items)
        expect(await paste(muya, block, 1, 1, '- x\n\n- y')).toBe('- ax\n\n- y\n');
    });

    it('does not merge when the bullet marker differs', async () => {
        const muya = bootMuya('- a\n');
        const block = contentBlocks(muya)[0];
        const md = await paste(muya, block, 1, 1, '* x');
        expect(md).not.toContain('- ax');
    });

    it('merges into the cursor paragraph of a loose item, not the first paragraph', async () => {
        // Loose item with two paragraphs; cursor in the SECOND ("second"@2).
        const muya = bootMuya('- a\n\n  second\n');
        const blocks = contentBlocks(muya);
        const second = blocks.find(b => b.text === 'second')!;
        // 'a' must survive; 'second'@2 -> 'se' + 'x', tail 'cond' sews to 'y'.
        expect(await paste(muya, second, 2, 2, '- x\n- y')).toBe('- a\n\n  sex\n\n- ycond\n');
    });

    it('places the caret after the folded text on a single-item merge', async () => {
        const muya = bootMuya('- abc\n');
        const block = contentBlocks(muya)[0];
        await paste(muya, block, 3, 3, '- X'); // end of 'abc'
        const { selection } = muya.editor;
        expect(muya.editor.activeContentBlock?.text).toBe('abcX');
        expect(selection.anchor?.offset).toBe(4);
        expect(selection.focus?.offset).toBe(4);
    });
});
