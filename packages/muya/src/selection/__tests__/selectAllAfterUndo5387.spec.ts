// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// Restored history can omit the undo caret, leaving the selection cached on
// a removed paragraph. Select All must resolve against the live tree (#5387).

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

function undoNewParagraphAfter(muya: Muya, text: string): void {
    const leaf = muya.editor.scrollPage!.firstContentInDescendant() as Content;
    expect(leaf.text).toBe(text);
    leaf.setCursor(text.length, text.length, true);
    muya.insertParagraph('after', 'b');
    muya.editor.transactions.flush();
    const history = muya.getHistory();
    history.stack.undo[0].selection = null;
    muya.setHistory(history);
    // @ts-expect-error reach into the private stack to pin the precondition.
    expect(muya.editor.history._stack.undo.map(entry => entry.selection)).toEqual([null]);
    muya.undo();
    expect(muya.getSelection()).toBeNull();
}

describe('selectAll after undo removed the caret paragraph (#5387)', () => {
    for (const markdown of ['a\n', 'a\n\nc\n']) {
        it(`selects the whole document of ${JSON.stringify(markdown)}`, () => {
            const muya = bootMuya(markdown);
            undoNewParagraphAfter(muya, 'a');
            const { selection } = muya.editor;
            const scrollPage = muya.editor.scrollPage!;

            selection.selectAll();

            const last = scrollPage.lastContentInDescendant()!;
            expect(selection.anchorBlock).toBe(scrollPage.firstContentInDescendant());
            expect(selection.focusBlock).toBe(last);
            expect(selection.anchor!.offset).toBe(0);
            expect(selection.focus!.offset).toBe(last.text.length);
        });
    }
});
