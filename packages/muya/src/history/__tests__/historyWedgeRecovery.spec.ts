// @vitest-environment happy-dom

import type Format from '../../block/base/format';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

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
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function firstContent(muya: Muya): Format {
    return muya.editor.scrollPage!.firstContentInDescendant() as unknown as Format;
}

function undoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.undo.length;
}

function ignoreChange(muya: Muya): boolean {
    // @ts-expect-error — reach into the private flag for test assertions.
    return muya.editor.history._ignoreChange;
}

async function editText(muya: Muya, text: string): Promise<void> {
    const content = firstContent(muya) as unknown as { text: string; checkInlineUpdate: () => void };
    content.text = text;
    content.checkInlineUpdate();
    await vi.waitFor(() => {
        expect(muya.getMarkdown()).toContain(text);
    });
}

describe('history recorder recovery after an undo/redo exception', () => {
    it('resets _ignoreChange and keeps recording when updateContents throws', async () => {
        const muya = bootMuya('seed\n');

        await editText(muya, 'seedX');
        await vi.waitFor(() => expect(undoDepth(muya)).toBe(1));

        const spy = vi
            .spyOn(muya.editor, 'updateContents')
            .mockImplementationOnce(() => {
                throw new Error('simulated replay failure');
            });

        expect(() => muya.undo()).toThrow('simulated replay failure');

        // The recorder must not be wedged: the in-flight guard has to be
        // released even though the apply threw.
        expect(ignoreChange(muya)).toBe(false);

        spy.mockRestore();

        // A subsequent edit must still reach the undo stack.
        await editText(muya, 'seedXY');
        await vi.waitFor(() => expect(undoDepth(muya)).toBeGreaterThan(0));
    });

    it('clear() resets a stuck _ignoreChange guard', () => {
        const muya = bootMuya('seed\n');

        // Simulate a guard left stuck on by a prior exception.
        // @ts-expect-error — force the private flag for the test.
        muya.editor.history._ignoreChange = true;

        muya.editor.history.clear();

        expect(ignoreChange(muya)).toBe(false);
    });
});
