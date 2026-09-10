// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    vi.restoreAllMocks();
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
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    bootedHosts.push(muya.domNode);
    return muya;
}

function holdPendingEdits() {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
}

describe('undo and redo with an edit that has not been flushed yet', () => {
    it('undo applies after the pending edit instead of corrupting the document', () => {
        const muya = bootMuya('hello\n');
        holdPendingEdits();
        const content = muya.editor.scrollPage!.firstContentInDescendant()!;

        content.text = 'hello world';
        muya.flush();
        muya.editor.history.cutoff();

        content.text = 'hello world!';
        expect(() => muya.undo()).not.toThrow();
        expect(() => muya.flush()).not.toThrow();

        expect(muya.getMarkdown()).toBe('hello world\n');
        expect(muya.editor.scrollPage!.firstContentInDescendant()!.text).toBe('hello world');
    });

    it('redo is dropped by an edit that was still pending', () => {
        const muya = bootMuya('hello\n');
        holdPendingEdits();
        const content = muya.editor.scrollPage!.firstContentInDescendant()!;

        content.text = 'hello world';
        muya.flush();
        muya.undo();
        expect(muya.getMarkdown()).toBe('hello\n');

        muya.editor.scrollPage!.firstContentInDescendant()!.text = 'hello there';
        expect(() => muya.redo()).not.toThrow();
        expect(() => muya.flush()).not.toThrow();

        expect(muya.getMarkdown()).toBe('hello there\n');
    });
});
