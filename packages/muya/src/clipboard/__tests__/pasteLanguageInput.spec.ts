// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import type { Muya } from '../../muya';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';
import { SelectionCaretType, SelectionDirection } from '../../selection/types';

// muyajs takes the FIRST line of a paste as the code block language and
// propagates it (re-highlight / language selector), rather than concatenating
// every line into the language identifier.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    // Returns a thenable so `CodeBlock.set lang` -> loadLanguage(value).then(...)
    // does not throw under the stubbed prism.
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

function pasteEvent(text: string) {
    return {
        preventDefault() {},
        stopPropagation() {},
        clipboardData: { getData: (t: string) => (t === 'text/plain' ? text : ''), files: [], items: [] },
    } as unknown as ClipboardEvent;
}

async function pasteInto(muya: Muya, block: Content, text: string): Promise<string> {
    const path = block.path;
    muya.editor.selection.getSelection = () => ({
        anchor: { offset: 0, block, path },
        focus: { offset: 0, block, path },
        isCollapsed: true,
        isSelectionInSameBlock: true,
        direction: SelectionDirection.FORWARD,
        type: SelectionCaretType.RANGE,
    });
    await muya.editor.clipboard.pasteHandler(pasteEvent(text), text, '');
    await new Promise(r => setTimeout(r, 40));
    return muya.getMarkdown();
}

describe('paste — into a code block language input (muyajs parity)', () => {
    it('uses only the first line as the language and propagates it', async () => {
        const muya = bootMuya('```\ncode line\n```\n');
        const langInput = contentBlocks(muya).find(b => b.blockName === 'language-input')!;

        const md = await pasteInto(muya, langInput, 'js\nignored second line');

        expect(md).toBe('```js\ncode line\n```\n');
    });
});
