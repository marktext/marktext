// @vitest-environment happy-dom

import type Content from '../../../base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../../../muya';

const bootedHosts: HTMLElement[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length)
        bootedHosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function bootMuya(markdown: string, fancyLists = true): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown, fancyLists } as ConstructorParameters<typeof Muya>[1]);
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

function press(muya: Muya, text: string, key: 'Tab' | 'Enter', { shiftKey = false, offset = text.length } = {}) {
    const content = contentByText(muya, text);
    muya.editor.activeContentBlock = content;
    content.setCursor(offset, offset, true);
    const event = { preventDefault: vi.fn(), stopPropagation: vi.fn(), key, shiftKey } as unknown as KeyboardEvent;
    if (key === 'Tab')
        content.tabHandler(event);
    else
        content.enterHandler(event);
    muya.editor.jsonState.flush();
}

const tab = (muya: Muya, text: string) => press(muya, text, 'Tab');
const shiftTab = (muya: Muya, text: string) => press(muya, text, 'Tab', { shiftKey: true });

describe('outline lists: Tab and Shift+Tab', () => {
    it('steps each new sublist down the outline ladder', () => {
        const muya = bootMuya('I.  l0\nII. l1\nIII. l2\nIV. l3\nV.  l4\nVI. l5\nVII. l6\n');
        for (const [index, text] of ['l1', 'l2', 'l3', 'l4', 'l5', 'l6'].entries()) {
            for (let step = 0; step <= index; step++)
                tab(muya, text);
        }

        expect(muya.getMarkdown()).toBe([
            'I.  l0',
            '    A.  l1',
            '        1. l2',
            '           a. l3',
            '              i. l4',
            '                 (1) l5',
            '                     (a) l6',
            '',
        ].join('\n'));

        for (let step = 0; step < 6; step++)
            shiftTab(muya, 'l6');

        expect(muya.getMarkdown()).toBe([
            'I.  l0',
            '    A.  l1',
            '        1. l2',
            '           a. l3',
            '              i. l4',
            '                 (1) l5',
            'II. l6',
            '',
        ].join('\n'));
    });

    it('steps one level back on each Shift+Tab', () => {
        const muya = bootMuya('I.  a\n    A.  b\n        1. c\n');
        shiftTab(muya, 'c');
        expect(muya.getMarkdown()).toBe('I.  a\n    A.  b\n    B.  c\n');
        shiftTab(muya, 'c');
        expect(muya.getMarkdown()).toBe('I.  a\n    A.  b\nII. c\n');
    });

    it('keeps the following items in their own list when an item with a different sublist moves out', () => {
        const muya = bootMuya('I.  a\n    A.  b\n        1. c\n    B.  d\n');
        shiftTab(muya, 'b');
        expect(muya.getMarkdown()).toBe('I.  a\nII. b\n    1. c\n    A.  d\n');
    });

    it('starts a sublist of a non-outline list at one in the parent style', () => {
        const muya = bootMuya('c. x\nd. y\n');
        tab(muya, 'y');
        expect(muya.getMarkdown()).toBe('c. x\n   a. y\n');
    });

    it('starts a decimal sublist at one only with the option on', () => {
        const off = bootMuya('3. a\n4. b\n', false);
        tab(off, 'b');
        expect(off.getMarkdown()).toBe('3. a\n   3. b\n');

        const on = bootMuya('3. a\n4. b\n');
        tab(on, 'b');
        expect(on.getMarkdown()).toBe('3. a\n   1. b\n');
    });

    it('keeps the # marker in a sublist', () => {
        const muya = bootMuya('#. x\n#. y\n');
        tab(muya, 'y');
        expect(muya.getMarkdown()).toBe('#. x\n   #. y\n');
    });

    it('nests a decimal list as before', () => {
        const muya = bootMuya('1. x\n2. y\n3. z\n');
        tab(muya, 'y');
        expect(muya.getMarkdown()).toBe('1. x\n   1. y\n2. z\n');
    });
});

describe('outline lists: Enter', () => {
    it('splits an item into the next marker of its level', () => {
        const muya = bootMuya('I.  a\n    A.  Background\n');
        press(muya, 'Background', 'Enter', { offset: 4 });
        expect(muya.getMarkdown()).toBe('I.  a\n    A.  Back\n    B.  ground\n');
    });
});
