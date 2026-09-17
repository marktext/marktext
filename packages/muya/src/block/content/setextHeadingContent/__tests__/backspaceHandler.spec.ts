// @vitest-environment jsdom

import type { Muya } from '../../../../muya';
import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya as MuyaClass } from '../../../../muya';

// #5035: Backspace at the start of a setext heading turns it into a paragraph,
// but left the key's default action running. The browser then merged the new
// paragraph into the block above and removed its element, leaving a paragraph
// in the block tree whose DOM node was detached; Enter, Enter on a bullet list
// right above it threw "Failed to execute 'insertBefore' on 'Node'".

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
    document.getSelection()?.removeAllRanges();
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

function findContent(muya: Muya, blockName: string): Content {
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && block.blockName !== blockName)
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no ${blockName} in the document`);
    return block;
}

function pressBackspace(content: Content): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    content.domNode!.dispatchEvent(event);
    return event;
}

describe('setextHeadingContent.backspaceHandler (#5035)', () => {
    it('turns the heading into a paragraph and cancels the key\'s default action', () => {
        const muya = bootMuya('- one\n- two\n\nHeading\n---\n');
        const heading = findContent(muya, 'setextheading.content');
        heading.setCursor(0, 0, true);

        const event = pressBackspace(heading);

        expect(event.defaultPrevented).toBe(true);
        muya.editor.jsonState.flush();
        expect(muya.getMarkdown()).toBe('- one\n- two\n\nHeading\n');
        expect(muya.editor.scrollPage!.lastChild?.blockName).toBe('paragraph');
    });

    it('leaves Backspace inside the heading text to the input handler', () => {
        const muya = bootMuya('Heading\n---\n');
        const heading = findContent(muya, 'setextheading.content');
        heading.setCursor(3, 3, true);

        const event = pressBackspace(heading);

        expect(event.defaultPrevented).toBe(false);
    });
});
