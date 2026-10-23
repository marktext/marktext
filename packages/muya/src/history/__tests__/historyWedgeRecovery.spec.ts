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

async function editText(muya: Muya, text: string): Promise<void> {
    const content = firstContent(muya) as unknown as { text: string; checkInlineUpdate: () => void };
    content.text = text;
    content.checkInlineUpdate();
    await vi.waitFor(() => {
        expect(muya.getMarkdown()).toContain(text);
    });
}

describe('history recorder recovery after an undo/redo exception', () => {
    it('keeps recording when replayContents throws', async () => {
        const muya = bootMuya('seed\n');

        await editText(muya, 'seedX');
        await vi.waitFor(() => expect(undoDepth(muya)).toBe(1));

        const spy = vi
            .spyOn(muya.editor, 'replayContents')
            .mockImplementationOnce(() => {
                throw new Error('simulated replay failure');
            });

        expect(() => muya.undo()).toThrow('simulated replay failure');

        spy.mockRestore();

        await editText(muya, 'seedXY');
        await vi.waitFor(() => expect(undoDepth(muya)).toBeGreaterThan(0));
    });

    it('records new edits started by a listener during history replay', async () => {
        const muya = bootMuya('seed\n');
        await editText(muya, 'seedX');
        muya.once('json-change', () => {
            firstContent(muya).text = 'listener edit';
            muya.flush();
        });
        muya.undo();
        expect(muya.getMarkdown()).toBe('listener edit\n');
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        expect(muya.getHistory().stack.redo).toHaveLength(0);
        muya.undo();
        expect(muya.getMarkdown()).toBe('seed\n');
    });
});
