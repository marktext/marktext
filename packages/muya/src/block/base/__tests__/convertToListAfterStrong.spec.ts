// @vitest-environment happy-dom

import type { Muya } from '../../../muya';
import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../../muya';

vi.mock('../../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

// #2429: typing a list marker on a new (soft-line-break) line after bold text
// converted the wrong character. `_convertToList`'s regex used a lazy pre-group
// that grabbed the `*` inside the closing `**` of the bold text as the bullet
// marker (because two trailing spaces followed it), instead of the `-` the user
// just typed on the next line — corrupting the bold syntax. The marker must be
// taken from the start of a line.

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
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

interface ILiveBlock {
    blockName?: string;
    meta?: { marker?: string };
    firstContentInDescendant: () => { text: string };
    children?: { forEach: (cb: (b: ILiveBlock) => void) => void };
}

// Collect the top-level blocks of the live block tree after conversion.
function convert(text: string): ILiveBlock[] {
    const muya = bootMuya('seed\n');
    const content = muya.editor.scrollPage!.firstContentInDescendant() as Format;
    content.text = text;
    content.checkInlineUpdate();

    const top: ILiveBlock[] = [];
    (muya.editor.scrollPage as unknown as ILiveBlock).children!.forEach(b => top.push(b));
    return top;
}

describe('_convertToList after bold text + soft-line-break (#2429)', () => {
    it('uses the `-` on the new line as the marker, not the `*` inside `**`', () => {
        // `**foo:**` + two spaces + soft-line-break + `- `
        const blocks = convert('**foo:**  \n- ');

        const list = blocks.find(b => b.blockName === 'bullet-list');
        expect(list).toBeDefined();
        // marker is the dash typed on the new line, not a `*` from the bold run.
        expect(list!.meta!.marker).toBe('-');

        // the bold text is preserved intact as a leading paragraph, not corrupted
        // into `**foo:*`.
        const para = blocks.find(b => b.blockName === 'paragraph');
        expect(para).toBeDefined();
        expect(para!.firstContentInDescendant().text).toBe('**foo:**');
    });

    it('still converts a plain single-line `- ` to a bullet list', () => {
        const blocks = convert('- ');
        expect(blocks.some(b => b.blockName === 'bullet-list')).toBe(true);
        // no spurious leading paragraph
        expect(blocks.some(b => b.blockName === 'paragraph')).toBe(false);
    });
});
