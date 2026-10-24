// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../muya';

// Legacy history can omit the undo caret; setContent without autoFocus also
// leaves cached blocks detached. Commands must reject either stale target
// without mutating the current document (#5355).

const bootedMuyas: Muya[] = [];

beforeEach(() => {
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function bootMuya(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedMuyas.push(muya);
    return muya;
}

function placeCaretAtEnd(muya: Muya, text: string): Content {
    let leaf = muya.editor.scrollPage!.firstContentInDescendant();
    while (leaf && leaf.text !== text)
        leaf = leaf.nextContentInContext() ?? null;
    if (!leaf)
        throw new Error(`no content block with text "${text}"`);
    leaf.setCursor(text.length, text.length, true);
    return leaf;
}

function undoEntrySelections(muya: Muya): unknown[] {
    // @ts-expect-error reach into the private stack to pin the precondition.
    return muya.editor.history._stack.undo.map(entry => entry.selection);
}

const DETACHING_SETUPS: [string, () => { muya: Muya; markdown: string }][] = [
    ['undo removed the caret paragraph', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        placeCaretAtEnd(muya, 'Hello');
        muya.insertParagraph('after', 'abc');
        muya.editor.transactions.flush();
        const history = muya.getHistory();
        history.stack.undo[0].selection = null;
        muya.setHistory(history);
        expect(undoEntrySelections(muya)).toEqual([null]);
        muya.undo();
        return { muya, markdown: 'Hello\n\nWorld\n' };
    }],
    ['setContent without autoFocus replaced the document', () => {
        const muya = bootMuya('Hello\n\nWorld\n');
        placeCaretAtEnd(muya, 'World');
        muya.setContent('Other\n\nDoc\n');
        return { muya, markdown: 'Other\n\nDoc\n' };
    }],
];

const COMMANDS: [string, (muya: Muya) => void][] = [
    ['insertParagraph before', muya => muya.insertParagraph('before')],
    ['insertParagraph after', muya => muya.insertParagraph('after')],
    ['createTable', muya => muya.createTable({ rows: 2, columns: 2 })],
];

describe('block commands while the caret caches point at a detached block (#5355)', () => {
    for (const [setupName, setup] of DETACHING_SETUPS) {
        for (const [commandName, run] of COMMANDS) {
            it(`${commandName} is a no-op after ${setupName}`, () => {
                const { muya, markdown } = setup();
                expect(muya.editor.activeContentBlock).toBeNull();

                expect(() => run(muya)).not.toThrow();
                muya.editor.transactions.flush();
                expect(muya.getMarkdown()).toBe(markdown);
            });
        }
    }
});
