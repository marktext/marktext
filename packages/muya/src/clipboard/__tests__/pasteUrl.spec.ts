// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';
import { tryPasteUrl } from '../pasteUrl';
import { PasteType } from '../types';

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => null,
    search: () => [],
}));

// DOMPurify requires a richer DOM; native HTML normalization is covered in browser tests.
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
        direction: start <= end ? SelectionDirection.FORWARD : SelectionDirection.BACKWARD,
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

describe('paste URL over selected text (#2029)', () => {
    it.each([
        'https://home.com',
        'http://localhost:3000',
        'https://example.com/path?q=中文#section',
        '  https://home.com  ',
    ])('keeps the selected label for %s', async (url) => {
        const muya = bootMuya('foo bar foo\n');
        expect(await paste(muya, contentBlocks(muya)[0], 4, 7, url))
            .toBe(`foo [bar](${url.trim()}) foo\n`);
    });

    it.each([
        ['# foo bar', 6, 9, '# foo [bar](https://home.com)\n'],
        ['- foo bar', 4, 7, '- foo [bar](https://home.com)\n'],
        ['> foo bar', 4, 7, '> foo [bar](https://home.com)\n'],
        ['foo **bar**', 4, 11, 'foo [**bar**](https://home.com)\n'],
        ['foo **bar**', 6, 9, 'foo **[bar](https://home.com)**\n'],
        ['foo 中文😀', 4, 8, 'foo [中文😀](https://home.com)\n'],
        ['foo [bar]', 4, 9, 'foo [\\[bar\\]](https://home.com)\n'],
    ])('supports inline selections in %s', async (source, start, end, expected) => {
        const muya = bootMuya(`${source}\n`);
        expect(await paste(muya, contentBlocks(muya)[0], start, end, 'https://home.com')).toBe(expected);
    });

    it('uses the original label even with rich clipboard HTML', async () => {
        const muya = bootMuya('foo bar foo\n');
        stubSelection(muya, contentBlocks(muya)[0], 7, 4);
        await muya.editor.clipboard.pasteHandler(pasteEvent('https://home.com'), 'https://home.com', '<a href="https://home.com">Page title</a>');
        await new Promise(r => setTimeout(r, 40));
        expect(muya.getMarkdown()).toBe('foo [bar](https://home.com) foo\n');
    });

    it('escapes parentheses in URL destinations', async () => {
        const muya = bootMuya('bar\n');
        expect(await paste(muya, contentBlocks(muya)[0], 0, 3, 'https://home.com/a(b)'))
            .toBe('[bar](https://home.com/a\\(b\\))\n');
    });

    it.each([
        ['foo bar', 4, 7, 'javascript:alert(1)'],
        ['foo bar', 4, 7, 'See https://home.com'],
        ['foo bar', 4, 7, 'https://home.com\nhttps://other.com'],
        ['foo bar', 4, 4, 'https://home.com'],
        ['foo **bar**', 5, 9, 'https://home.com'],
        ['foo `bar`', 5, 8, 'https://home.com'],
        ['foo $bar$', 5, 8, 'https://home.com'],
        ['foo [bar](https://old.com)', 5, 8, 'https://home.com'],
        ['foo ![bar](image.png)', 6, 9, 'https://home.com'],
        ['```\nbar\n```', 0, 3, 'https://home.com'],
    ])('leaves unsupported selection/payload on the normal path: %s', (source, start, end, url) => {
        const muya = bootMuya(`${source}\n`);
        const block = contentBlocks(muya).find(block => block.blockName !== 'language-input')!;
        stubSelection(muya, block, start, end);
        expect(tryPasteUrl(muya.editor.clipboard, block, url, PasteType.NORMAL)).toBe(false);
    });

    it('creates a link inside one table cell', async () => {
        const muya = bootMuya('| foo bar | other |\n| --- | --- |\n| x | y |\n');
        const block = contentBlocks(muya).find(block => block.text === 'foo bar')!;
        expect(await paste(muya, block, 4, 7, 'https://home.com')).toContain('foo [bar](https://home.com)');
    });

    it('does not wrap a reference link', () => {
        const muya = bootMuya('[bar][ref]\n\n[ref]: https://old.com\n');
        const block = contentBlocks(muya)[0];
        stubSelection(muya, block, 1, 4);
        expect(tryPasteUrl(muya.editor.clipboard, block, 'https://home.com', PasteType.NORMAL)).toBe(false);
    });

    it('does not handle a table rectangle or cross-block selection', () => {
        const muya = bootMuya('foo bar\n\nother\n');
        const block = contentBlocks(muya)[0];
        stubSelection(muya, block, 4, 7);
        vi.spyOn(muya.editor.selection.table, 'hasSelection', 'get').mockReturnValue(true);
        expect(tryPasteUrl(muya.editor.clipboard, block, 'https://home.com', PasteType.NORMAL)).toBe(false);
        vi.restoreAllMocks();
        const selection = muya.editor.selection.getSelection()!;
        muya.editor.selection.getSelection = () => ({ ...selection, isSelectionInSameBlock: false });
        expect(tryPasteUrl(muya.editor.clipboard, block, 'https://home.com', PasteType.NORMAL)).toBe(false);
    });

    it('plain-text paste still replaces the selection', async () => {
        const muya = bootMuya('foo bar foo\n');
        stubSelection(muya, contentBlocks(muya)[0], 4, 7);
        muya.editor.clipboard.pasteType = PasteType.PASTE_AS_PLAIN_TEXT;
        await muya.editor.clipboard.pasteHandler(pasteEvent('https://home.com'));
        await new Promise(r => setTimeout(r, 40));
        expect(muya.getMarkdown()).toBe('foo https://home.com foo\n');
    });
});
