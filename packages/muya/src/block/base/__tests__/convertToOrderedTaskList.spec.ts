// @vitest-environment happy-dom

import type { Muya } from '../../../muya';
import type Format from '../format';
import type Parent from '../parent';
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
    meta?: Record<string, unknown>;
    firstContentInDescendant: () => { text: string };
    children?: { forEach: (cb: (b: ILiveBlock) => void) => void };
}

function convert(text: string): ILiveBlock[] {
    const muya = bootMuya('seed\n');
    const content = muya.editor.scrollPage!.firstContentInDescendant() as Format;
    content.text = text;
    content.checkInlineUpdate();

    const top: ILiveBlock[] = [];
    (muya.editor.scrollPage as unknown as ILiveBlock).children!.forEach(b => top.push(b));
    return top;
}

// `1. [ ] text` builds an ordered task list, the way `- [ ] text` builds the
// unordered one (#1691).
describe('typing an ordered task marker (#1691)', () => {
    it('converts `1. [ ] foo` into an ordered task list', () => {
        const blocks = convert('1. [ ] foo');
        const list = blocks.find(b => b.blockName === 'task-list');

        expect(list).toBeDefined();
        expect(list!.meta).toMatchObject({ ordered: true, start: 1, delimiter: '.' });
    });

    it('converts `3) [x] foo` with its delimiter and start number', () => {
        const blocks = convert('3) [x] foo');
        const list = blocks.find(b => b.blockName === 'task-list');

        expect(list).toBeDefined();
        expect(list!.meta).toMatchObject({ ordered: true, start: 3, delimiter: ')' });
    });

    it('keeps `- [ ] foo` as an unordered task list', () => {
        const blocks = convert('- [ ] foo');
        const list = blocks.find(b => b.blockName === 'task-list');

        expect(list).toBeDefined();
        expect(list!.meta).toMatchObject({ marker: '-' });
        expect(list!.meta!.ordered).toBeUndefined();
    });
});

// Converting one item splits an ordered list in two; the tail must keep
// numbering from where the converted item left off (#1691).
describe('ordered numbering when an item becomes a task (#1691)', () => {
    function typeIntoItem(markdown: string, index: number, text: string): string {
        const muya = bootMuya(markdown);
        const list = muya.editor.scrollPage!.find(0) as unknown as Parent;
        const item = list.find(index) as unknown as Parent;
        const content = item.firstContentInDescendant() as Format;
        content.text = text;
        content.checkInlineUpdate();
        // The conversion queues its edits on the JSON state; flush before reading
        // the document back out (as the editor does before a tab switch).
        muya.flush();

        return muya.getMarkdown();
    }

    it('numbers the tail after the first item', () => {
        expect(typeIntoItem('1. a\n2. b\n3. c\n', 0, '[ ] a')).toBe(
            '1. [ ] a\n\n2. b\n3. c\n',
        );
    });

    it('numbers the tail after a middle item', () => {
        expect(typeIntoItem('1. a\n2. b\n3. c\n', 1, '[ ] b')).toBe(
            '1. a\n\n2. [ ] b\n\n3. c\n',
        );
    });

    it('numbers the tail after a first item of an offset list', () => {
        expect(typeIntoItem('5. a\n6. b\n', 0, '[x] a')).toBe('5. [x] a\n\n6. b\n');
    });

    it('shows the rebased number in the live DOM', () => {
        const muya = bootMuya('1. a\n2. b\n3. c\n');
        const list = muya.editor.scrollPage!.find(0) as unknown as Parent;
        const content = (list.find(0) as unknown as Parent)
            .firstContentInDescendant() as Format;
        content.text = '[ ] a';
        content.checkInlineUpdate();

        const tail = muya.editor.scrollPage!.find(1) as unknown as Parent;
        expect(tail.blockName).toBe('order-list');
        expect(tail.domNode!.getAttribute('start')).toBe('2');
    });
});
