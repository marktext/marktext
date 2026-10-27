// @vitest-environment happy-dom

import type Content from '../../../base/content';
import type Parent from '../../../base/parent';
import { afterEach, describe, expect, it } from 'vitest';
import { Muya } from '../../../../muya';
import { createTextSelectionState } from '../../../../selection/state';

const editors: Muya[] = [];

function bootMuya(markdown: string, fancyLists = true): Muya {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.append(host);
    const muya = new Muya(host, { markdown, fancyLists });
    muya.init();
    editors.push(muya);
    return muya;
}

function contentByText(muya: Muya, text: string): Content {
    let found: Content | undefined;
    const visit = (parent: Parent) => parent.forEach((child) => {
        if (child.isContent() && child.text === text)
            found = child;
        else if (child.isParent())
            visit(child);
    });
    visit(muya.editor.scrollPage!);
    if (!found)
        throw new Error(`Missing content ${JSON.stringify(text)}`);
    return found;
}

function press(muya: Muya, text: string, key: 'Tab' | 'Enter', { shiftKey = false, offset = 0 } = {}) {
    const block = contentByText(muya, text);
    muya.setSelection(createTextSelectionState(
        { block, path: block.path, offset },
        { block, path: block.path, offset },
    ));
    block.domNode!.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
}

// List Tab and Shift+Tab move an item only from the start of its text.
const tab = (muya: Muya, text: string) => press(muya, text, 'Tab');
const shiftTab = (muya: Muya, text: string) => press(muya, text, 'Tab', { shiftKey: true });

afterEach(() => {
    for (const editor of editors.splice(0)) {
        editor.destroy();
        editor.domNode.remove();
    }
    document.getSelection()?.removeAllRanges();
});

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

    it('undoes one outline Tab or Shift+Tab per step', () => {
        const source = 'I.  a\nII. b\n';
        const muya = bootMuya(source);
        tab(muya, 'b');
        expect(muya.getMarkdown()).toBe('I.  a\n    A.  b\n');
        shiftTab(muya, 'b');
        expect(muya.getMarkdown()).toBe(source);
        muya.undo();
        expect(muya.getMarkdown()).toBe('I.  a\n    A.  b\n');
        muya.undo();
        expect(muya.getMarkdown()).toBe(source);
        muya.redo();
        expect(muya.getMarkdown()).toBe('I.  a\n    A.  b\n');
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
