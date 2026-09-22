// @vitest-environment jsdom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CLASS_NAMES } from '../../../../config';
import { Muya } from '../../../../muya';

// #5114 — layout and caret placement are covered by
// e2e/tests/blocks/codeblock-trailing-newline-5114.spec.ts; this pins the DOM
// contract the fix relies on.

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

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function codeContent(muya: Muya): Content {
    let target: Content | null = null;
    const visit = (block: {
        constructor: { blockName?: string };
        children?: { forEach: (cb: (b: unknown) => void) => void };
    }) => {
        if (block.constructor.blockName === 'codeblock.content')
            target = block as unknown as Content;
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error('codeblock.content block not found');
    return target;
}

function trailingBreak(content: Content): Element | null {
    return content.domNode!.querySelector(`:scope > .${CLASS_NAMES.MU_TRAILING_BREAK}`);
}

describe('codeBlockContent trailing newline', () => {
    it('ends the rendered code with a line break when the text ends with a newline', () => {
        const content = codeContent(bootMuya('```\nhello\n```\n'));
        content.text = 'hello\n\n';
        content.update();

        const lineBreak = trailingBreak(content);
        expect(lineBreak).not.toBeNull();
        expect(content.domNode!.lastChild).toBe(lineBreak);
        expect(lineBreak!.innerHTML).toBe('<br>');
        expect(content.domNode!.textContent).toBe('hello\n\n');
    });

    it('renders no trailing line break when the text does not end with a newline', () => {
        const content = codeContent(bootMuya('```\nhello\n```\n'));
        content.text = 'hello\nworld';
        content.update();

        expect(trailingBreak(content)).toBeNull();
        expect(content.domNode!.innerHTML).toBe('hello\nworld');
    });

    it('keeps the trailing line break on a syntax-highlighted block', () => {
        const content = codeContent(bootMuya('```js\nconst a = 1\n```\n'));
        content.text = 'const a = 1\n';
        content.update();

        expect(content.domNode!.querySelector('.token')).not.toBeNull();
        expect(content.domNode!.lastChild).toBe(trailingBreak(content));
        expect(content.domNode!.textContent).toBe('const a = 1\n');
    });

    it('seeds the IME composition anchor in front of the trailing line break', () => {
        const content = codeContent(bootMuya('```\nhello\n```\n'));
        content.text = 'hello\n\n';
        content.setCursor(7, 7, true);

        content.composeHandler(new CompositionEvent('compositionstart', { data: '' }));

        const lineBreak = trailingBreak(content)!;
        expect(content.domNode!.lastChild).toBe(lineBreak);
        expect(lineBreak.previousSibling?.nodeType).toBe(Node.TEXT_NODE);
        expect(lineBreak.previousSibling?.textContent).toBe(String.fromCharCode(0x200B));
    });
});
