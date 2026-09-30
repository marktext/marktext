// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../../muya';

let muya: Muya;

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    vi.useFakeTimers();
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'hello\n' });
    muya.init();
});

afterEach(() => {
    muya.destroy();
    muya.domNode.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.getSelection()?.removeAllRanges();
});

function edit(text: string) {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    first.setCursor(0, 0, true);
    first.text = text;
}

describe('history with pending edits', () => {
    it('records and undoes a first edit before its animation frame', () => {
        edit('hello!');
        muya.undo();
        expect(muya.getMarkdown().trim()).toBe('hello');
        muya.redo();
        expect(muya.getMarkdown().trim()).toBe('hello!');
    });

    it('rechecks redo after a pending edit invalidates it', () => {
        edit('hello!');
        muya.flush();
        vi.advanceTimersByTime(2000);
        muya.undo();
        expect(muya.getHistory().stack.redo).toHaveLength(1);
        edit('new text');
        expect(() => muya.redo()).not.toThrow();
        expect(muya.getHistory().stack.redo).toHaveLength(0);
        expect(muya.getMarkdown().trim()).toBe('new text');
    });
});
