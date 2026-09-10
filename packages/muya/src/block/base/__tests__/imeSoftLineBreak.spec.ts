// @vitest-environment jsdom

import type Format from '../format';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../muya';

// #5279 — a Shift+Enter soft line break is lost when the next text is
// committed by a CJK IME.
//
// Chromium drops the trailing `\n` from the DOM as soon as text is typed at
// the end of a block that ends in one; `lineBreakAutoPair` re-attaches it.
// The plain-typing path reaches that repair, the IME path did not, so the
// paragraph collapsed onto a single line.
//
// The DOM mutation staged below is not invented — it is what Chromium 141
// actually does, captured by driving a real composition through CDP
// `Input.imeSetComposition` against the E2E host:
//
//   after Shift+Enter   <span class="mu-plain-text">第一行</span>
//                       <span class="mu-soft-line-break mu-line-end">\n</span>
//   mid-composition     <span class="mu-plain-text">第一行</span>
//                       <span class="mu-soft-line-break mu-line-end">第二行</span>
//
// i.e. the composed text replaces the `\n` inside the soft-line-break span.
//
// Build the commit event with the real `CompositionEvent` constructor. An
// object literal carrying a stub `inputType` would sail through
// `isInputEvent` (`'inputType' in event`) and pass no matter what the
// production guard does — which is exactly how this bug reached a release
// with a green regression test. jsdom rather than happy-dom because only
// jsdom carries `data` through the CompositionEvent constructor, and the
// committed string is the whole point of the event.

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
    if (hadVersion) {
        window.MUYA_VERSION = originalVersion as string;
    }
    else {
        delete (window as Partial<Window>).MUYA_VERSION;
    }
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstBlock(muya: Muya): Format {
    const content = muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
    muya.editor.activeContentBlock = content as never;
    return content;
}

function pressShiftEnter(content: Format): void {
    content.keydownHandler(new KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
    }));
}

/**
 * Replay a CJK IME commit of `composed` at the end of the block, the way
 * Chromium delivers it: the composed text overwrites the `\n` held by the
 * soft-line-break span, then `compositionend` carries the committed string.
 */
function commitComposition(content: Format, composed: string): void {
    content.composeHandler(new CompositionEvent('compositionstart', { data: '' }));

    const lineBreak = content.domNode!.querySelector('.mu-soft-line-break')!;
    const textNode = lineBreak.firstChild as Text;
    textNode.data = composed;

    const range = document.createRange();
    range.setStart(textNode, composed.length);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);

    content.composeHandler(new CompositionEvent('compositionend', { data: composed }));
}

describe('soft line break followed by an IME commit', () => {
    it('keeps the soft line break when the next text is committed by an IME', () => {
        const muya = bootMuya('第一行\n');
        const content = firstBlock(muya);
        content.setCursor(3, 3);

        pressShiftEnter(content);
        expect(content.text).toBe('第一行\n');

        commitComposition(content, '第二行');

        expect(content.text).toBe('第一行\n第二行');
    });

    it('keeps the soft line break when the next text is typed without an IME', () => {
        const muya = bootMuya('第一行\n');
        const content = firstBlock(muya);
        content.setCursor(3, 3);

        pressShiftEnter(content);

        // Same Chromium mutation, delivered as plain typing: the character
        // overwrites the `\n` and arrives as an `insertText` InputEvent.
        const lineBreak = content.domNode!.querySelector('.mu-soft-line-break')!;
        const textNode = lineBreak.firstChild as Text;
        textNode.data = 'x';
        const range = document.createRange();
        range.setStart(textNode, 1);
        range.collapse(true);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);

        content.inputHandler(new InputEvent('input', { inputType: 'insertText', data: 'x' }));

        expect(content.text).toBe('第一行\nx');
    });
});
