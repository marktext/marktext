// @vitest-environment happy-dom

import type Content from '../content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../muya';

// #5296 — a paragraph cannot hold an empty line: in Markdown a blank line ends the
// paragraph, so a block edited into `abc\n\ndef` is saved as two paragraphs and
// reopens as two. A Shift+Enter that would leave such a line behind breaks the
// paragraph instead, exactly as Enter does at that position.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function contentByText(muya: Muya, text: string): Content {
    let target: Content | null = null;
    const visit = (block: {
        text?: string;
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName?.endsWith('.content') && block.text === text)
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error(`content block with text "${text}" not found`);
    return target;
}

function placeCaret(muya: Muya, content: Content, start: number, end = start): void {
    muya.editor.activeContentBlock = content;
    content.setCursor(start, end, true);
}

function flush(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

async function pressShiftEnter(muya: Muya): Promise<void> {
    muya.editor.activeContentBlock!.keydownHandler(new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
    }));
    await flush();
}

interface IBlockShape { name: string; text?: string; children?: IBlockShape[] }

function blocks(muya: Muya): IBlockShape[] {
    return JSON.parse(JSON.stringify(muya.getState(), ['name', 'text', 'children']));
}

function caret(muya: Muya): { text: string; offset: number } {
    const active = muya.editor.activeContentBlock!;
    return { text: active.text, offset: active.getCursor()!.start.offset };
}

describe('shift+Enter that would leave an empty line breaks the paragraph', () => {
    it('turns a second Shift+Enter at the end into a new empty paragraph', async () => {
        const muya = bootMuya('abc\n');
        placeCaret(muya, contentByText(muya, 'abc'), 3);

        await pressShiftEnter(muya);
        expect(blocks(muya)).toEqual([{ name: 'paragraph', text: 'abc\n' }]);

        await pressShiftEnter(muya);
        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: '' },
        ]);
        expect(caret(muya)).toEqual({ text: '', offset: 0 });
    });

    it('moves the text after the caret into the new paragraph', async () => {
        const muya = bootMuya('abc\ndef\n');
        placeCaret(muya, contentByText(muya, 'abc\ndef'), 4);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: 'def' },
        ]);
        expect(caret(muya)).toEqual({ text: 'def', offset: 0 });
    });

    it('drops the line breaks on both sides of an empty line', async () => {
        const muya = bootMuya('abc\n');
        const content = contentByText(muya, 'abc');
        content.text = 'abc\n\ndef';
        placeCaret(muya, content, 4);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: 'def' },
        ]);
        expect(caret(muya)).toEqual({ text: 'def', offset: 0 });
    });

    it('treats a line holding only spaces and tabs as empty', async () => {
        const muya = bootMuya('abc\n');
        const content = contentByText(muya, 'abc');
        content.text = 'abc\n \t';
        placeCaret(muya, content, 6);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: '' },
        ]);
    });

    it('removes a trailing-spaces hard break marker with the line break', async () => {
        const muya = bootMuya('abc\n');
        const content = contentByText(muya, 'abc');
        content.text = 'abc  \n';
        placeCaret(muya, content, 6);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: '' },
        ]);
    });

    it('removes a backslash hard break marker with the line break', async () => {
        const muya = bootMuya('abc\n');
        const content = contentByText(muya, 'abc');
        content.text = 'abc\\\n';
        placeCaret(muya, content, 5);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: '' },
        ]);
    });

    it('keeps an escaped backslash that ends the previous line', async () => {
        const muya = bootMuya('abc\n');
        const content = contentByText(muya, 'abc');
        content.text = 'abc\\\\\n';
        placeCaret(muya, content, 6);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc\\\\' },
            { name: 'paragraph', text: '' },
        ]);
    });

    it('deletes a selection that starts right after a soft break', async () => {
        const muya = bootMuya('abc\ndef\n');
        placeCaret(muya, contentByText(muya, 'abc\ndef'), 4, 6);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'paragraph', text: 'abc' },
            { name: 'paragraph', text: 'f' },
        ]);
        expect(caret(muya)).toEqual({ text: 'f', offset: 0 });
    });
});

describe('shift+Enter that leaves no empty line still inserts a soft break', () => {
    it('inserts a line between two lines when the caret is before a soft break', async () => {
        const muya = bootMuya('abc\ndef\n');
        placeCaret(muya, contentByText(muya, 'abc\ndef'), 3);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([{ name: 'paragraph', text: 'abc\n\ndef' }]);
        expect(caret(muya)).toEqual({ text: 'abc\n\ndef', offset: 4 });
    });

    it('inserts a soft break at the start of a paragraph', async () => {
        const muya = bootMuya('abc\n');
        placeCaret(muya, contentByText(muya, 'abc'), 0);

        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([{ name: 'paragraph', text: '\nabc' }]);
    });
});

describe('the paragraph break matches Enter inside containers', () => {
    it('starts a new list item from a list item holding one paragraph', async () => {
        const muya = bootMuya('- abc\n');
        placeCaret(muya, contentByText(muya, 'abc'), 3);

        await pressShiftEnter(muya);
        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([{
            name: 'bullet-list',
            children: [
                { name: 'list-item', children: [{ name: 'paragraph', text: 'abc' }] },
                { name: 'list-item', children: [{ name: 'paragraph', text: '' }] },
            ],
        }]);
    });

    it('adds a paragraph to a list item that already holds several', async () => {
        const muya = bootMuya('- abc\n\n  def\n');
        placeCaret(muya, contentByText(muya, 'def'), 3);

        await pressShiftEnter(muya);
        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([{
            name: 'bullet-list',
            children: [{
                name: 'list-item',
                children: [
                    { name: 'paragraph', text: 'abc' },
                    { name: 'paragraph', text: 'def' },
                    { name: 'paragraph', text: '' },
                ],
            }],
        }]);
    });

    it('adds a paragraph inside a block quote', async () => {
        const muya = bootMuya('> abc\n');
        placeCaret(muya, contentByText(muya, 'abc'), 3);

        await pressShiftEnter(muya);
        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([{
            name: 'block-quote',
            children: [
                { name: 'paragraph', text: 'abc' },
                { name: 'paragraph', text: '' },
            ],
        }]);
    });

    it('adds a paragraph after a setext heading', async () => {
        const muya = bootMuya('Title\n===\n');
        placeCaret(muya, contentByText(muya, 'Title'), 5);

        await pressShiftEnter(muya);
        await pressShiftEnter(muya);

        expect(blocks(muya)).toEqual([
            { name: 'setext-heading', text: 'Title' },
            { name: 'paragraph', text: '' },
        ]);
    });
});

describe('the paragraph break survives undo and saving', () => {
    it('undoes only the paragraph break, keeping the first soft break', async () => {
        const muya = bootMuya('abc\n');
        placeCaret(muya, contentByText(muya, 'abc'), 3);

        await pressShiftEnter(muya);
        await pressShiftEnter(muya);
        muya.undo();

        await vi.waitFor(() => {
            expect(blocks(muya)).toEqual([{ name: 'paragraph', text: 'abc\n' }]);
        });
    });

    it('reopens the saved markdown as the blocks shown in the editor', async () => {
        const muya = bootMuya('abc\ndef\n');
        placeCaret(muya, contentByText(muya, 'abc\ndef'), 4);

        await pressShiftEnter(muya);

        expect(blocks(bootMuya(muya.getMarkdown()))).toEqual(blocks(muya));
    });
});
