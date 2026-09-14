// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';

// happy-dom gives a collapsed caret no client rects — as Chromium does on an
// empty line — so without a text-based answer Content.arrowHandler takes every
// caret for the edge of the block.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
    document.getSelection()?.removeAllRanges();
    if (hadVersion)
        window.MUYA_VERSION = originalVersion as string;
    else
        delete (window as Partial<Window>).MUYA_VERSION;
});

function codeContentWithCaret(text: string, offset: number): { muya: Muya; content: Content } {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown: '```\nhello\n```\n' } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);

    let content: Content | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'codeblock.content')
            content = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!content)
        throw new Error('codeblock.content block not found');

    const found: Content = content;
    found.text = text;
    found.setCursor(offset, offset, true);
    return { muya, content: found };
}

function pressArrow(content: Content, key: 'ArrowUp' | 'ArrowDown'): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    content.arrowHandler(event);
    return event;
}

describe('codeBlockContent.arrowHandler', () => {
    it('leaves ArrowUp on the empty last line to the browser', () => {
        const { muya, content } = codeContentWithCaret('hello\nworld\n', 12);

        expect(pressArrow(content, 'ArrowUp').defaultPrevented).toBe(false);
        expect(muya.editor.activeContentBlock).toBe(content);
    });

    it('leaves ArrowDown on an empty middle line to the browser', () => {
        const { muya, content } = codeContentWithCaret('hello\n\nworld', 6);

        expect(pressArrow(content, 'ArrowDown').defaultPrevented).toBe(false);
        expect(muya.editor.activeContentBlock).toBe(content);
    });

    it('still handles ArrowUp on the first line', () => {
        const { content } = codeContentWithCaret('hello\nworld', 3);

        expect(pressArrow(content, 'ArrowUp').defaultPrevented).toBe(true);
    });

    it('still handles ArrowDown on the last line', () => {
        const { content } = codeContentWithCaret('hello\nworld', 11);

        expect(pressArrow(content, 'ArrowDown').defaultPrevented).toBe(true);
    });
});
