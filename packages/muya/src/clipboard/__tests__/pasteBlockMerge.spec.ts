// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// muyajs `pasteCtrl` MERGE semantics ported into @muyajs/core: pasting a
// paragraph into a non-empty text block merges its first paragraph inline
// (head + pasted + tail) instead of inserting it as a separate block below;
// the trailing text of the anchor is sewn onto the last pasted block; a
// multi-line paragraph pasted into a heading keeps only its first line in the
// heading; a same-type list pasted into a list item merges into that list.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

// normalizePastedHTML uses DOMPurify which needs a richer DOM than happy-dom
// gives; we only paste plain-text markdown here, so pass the html through.
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

function stubSelection(muya: Muya, block: Content, start: number, end: number) {
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: start, block, path },
        focus: { offset: end, block, path },
        isCollapsed: start === end,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
}

function pasteEvent(text: string) {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: {
            getData: (t: string) => (t === 'text/plain' ? text : ''),
            files: [],
            items: [],
        },
    } as unknown as ClipboardEvent;
}

async function paste(muya: Muya, block: Content, start: number, end: number, text: string): Promise<string> {
    stubSelection(muya, block, start, end);
    await muya.editor.clipboard.pasteHandler(pasteEvent(text), text, '');
    await new Promise(r => setTimeout(r, 40));
    return muya.getMarkdown();
}

describe('paste — paragraph merges inline into a non-empty text block (A3)', () => {
    it('pasting a paragraph at the cursor merges it into the paragraph', async () => {
        const muya = bootMuya('foobar\n');
        const block = contentBlocks(muya)[0];
        expect(await paste(muya, block, 3, 3, 'hello')).toBe('foohellobar\n');
    });

    it('pasting over a selection replaces it inline (A4)', async () => {
        const muya = bootMuya('foobar\n');
        const block = contentBlocks(muya)[0];
        expect(await paste(muya, block, 3, 5, 'X')).toBe('fooXr\n');
    });

    it('pasting multiple paragraphs merges the first and sews the tail onto the last', async () => {
        const muya = bootMuya('foobar\n');
        const block = contentBlocks(muya)[0];
        expect(await paste(muya, block, 3, 3, 'one\n\ntwo')).toBe('fooone\n\ntwobar\n');
    });
});

describe('paste — multi-line paragraph into a heading keeps only the first line (A6)', () => {
    it('only the first soft-line lands in the heading, the rest become a paragraph', async () => {
        const muya = bootMuya('# Title\n');
        const block = contentBlocks(muya)[0]; // atx-heading content, text '# Title'
        expect(await paste(muya, block, block.text.length, block.text.length, 'a\nb\nc')).toBe(
            '# Titlea\n\nb\nc\n',
        );
    });

    it('pasting multiple paragraphs mid-heading sews the heading tail after the paste', async () => {
        const muya = bootMuya('# hello world\n');
        const block = contentBlocks(muya)[0]; // '# hello world'
        // cursor between 'hello ' and 'world' (offset 8); 'world' must trail the
        // whole paste, not stay in the heading.
        expect(await paste(muya, block, 8, 8, 'A\n\nB')).toBe('# hello A\n\nBworld\n');
    });

    it('pasting a single paragraph mid-heading keeps it on the heading line', async () => {
        const muya = bootMuya('# hello world\n');
        const block = contentBlocks(muya)[0];
        expect(await paste(muya, block, 8, 8, 'A')).toBe('# hello Aworld\n');
    });

    it('a multi-line paragraph pasted into a SETEXT heading stays one block (only atx splits)', async () => {
        const muya = bootMuya('Title\n===\n');
        const block = contentBlocks(muya)[0]; // setext-heading content 'Title'
        const md = await paste(muya, block, block.text.length, block.text.length, 'aaa\nbbb');
        // muyajs keeps the whole paragraph inside the setext heading — one block.
        expect(muya.editor.scrollPage!.length()).toBe(1);
        expect(md).toContain('Titleaaa');
        expect(md).toContain('bbb');
    });
});

describe('paste — NEWLINE into an emptied non-paragraph wrapper (muyajs removeBlock parity)', () => {
    it('removes the emptied heading wrapper instead of leaving a stray empty block', async () => {
        const muya = bootMuya('# heading\n');
        const block = contentBlocks(muya)[0];
        // cursor before the heading text (offset 0); paste a non-mergeable block.
        await paste(muya, block, 0, 0, '---');
        // muyajs's NEWLINE branch removes the now-empty wrapper unconditionally;
        // the heading must not linger as a stray empty block.
        expect(muya.editor.scrollPage!.length()).toBe(1);
    });
});
