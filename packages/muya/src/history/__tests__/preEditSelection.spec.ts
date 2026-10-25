// @vitest-environment happy-dom
import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

let muya: Muya;

beforeEach(() => {
    window.MUYA_VERSION = 'test';
    const host = document.createElement('div');
    document.body.appendChild(host);
    muya = new Muya(host, { markdown: 'first\n\nsecond\n' });
    muya.init();
});

afterEach(() => {
    muya.destroy();
    muya.domNode.remove();
    document.getSelection()?.removeAllRanges();
    delete (window as Partial<Window>).MUYA_VERSION;
});

function nativeInput(block: Content, text: string, offset: number) {
    block.domNode!.dispatchEvent(new InputEvent('beforeinput', {
        bubbles: true,
        inputType: 'insertText',
        data: 'X',
    }));
    block.domNode!.textContent = text;
    document.getSelection()!.setBaseAndExtent(block.domNode!.firstChild!, offset, block.domNode!.firstChild!, offset);
    block.domNode!.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: 'X',
    }));
}

describe('history captures the pre-edit selection', () => {
    it('restores the caret before the first native input after loading (#5258)', () => {
        const block = muya.editor.scrollPage!.lastContentInDescendant()!;
        block.setCursor(5, 5, true);
        nativeInput(block, 'seconXd', 6);
        muya.flush();

        expect(muya.getHistory().stack.undo[0].selection?.anchor.offset).toBe(5);
        muya.undo();
        expect(muya.getMarkdown()).toContain('second');
        expect(muya.editor.selection.getSelectionState()?.anchor.offset).toBe(5);
        nativeInput(block, 'seconYd', 6);
        muya.flush();
        expect(muya.getMarkdown()).toContain('seconYd');
    });

    it('saves both endpoints before replacing a text range', () => {
        const block = muya.editor.scrollPage!.lastContentInDescendant()!;
        block.setCursor(1, 5, true);
        const before = muya.editor.selection.getSelectionState();
        nativeInput(block, 'sXd', 2);
        muya.flush();

        expect(muya.getHistory().stack.undo[0].selection).toEqual(before);
        muya.undo();
        expect(muya.getMarkdown()).toContain('second');
    });

    it('captures an unscoped Block edit before its text changes', () => {
        const block = muya.editor.scrollPage!.lastContentInDescendant()!;
        block.setCursor(5, 5, true);
        block.text = 'seconXd';
        block.setCursor(6, 6, true);
        muya.undo();

        expect(muya.getMarkdown()).toContain('second');
        expect(muya.editor.selection.getSelectionState()?.anchor.offset).toBe(5);
    });

    it('keeps the earliest caret when consecutive inputs merge', () => {
        const block = muya.editor.scrollPage!.lastContentInDescendant()!;
        block.setCursor(5, 5, true);
        nativeInput(block, 'seconXd', 6);
        nativeInput(block, 'seconXXd', 7);
        muya.flush();
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        expect(muya.getHistory().stack.undo[0].selection?.anchor.offset).toBe(5);
        muya.undo();
        expect(muya.getMarkdown()).toContain('second');
    });

    it('preserves the composition-start caret through intermediate beforeinput events', () => {
        const block = muya.editor.scrollPage!.lastContentInDescendant()!;
        block.setCursor(5, 5, true);
        block.domNode!.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
        nativeInput(block, 'secon中d', 6);
        nativeInput(block, 'secon中文d', 7);
        block.domNode!.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '中文' }));
        muya.flush();
        expect(muya.getMarkdown()).toContain('secon中文d');
        expect(muya.getHistory().stack.undo[0].selection?.anchor.offset).toBe(5);
        muya.undo();
        expect(muya.getMarkdown()).toContain('second');
    });

    it('separates a new edit after a caret move without adding selection-only history', () => {
        const block = muya.editor.scrollPage!.lastContentInDescendant()!;
        block.setCursor(5, 5, true);
        nativeInput(block, 'seconXd', 6);
        muya.flush();
        block.setCursor(0, 0, true);
        expect(muya.getHistory().stack.undo).toHaveLength(1);
        nativeInput(block, 'XseconXd', 1);
        muya.flush();
        expect(muya.getHistory().stack.undo).toHaveLength(2);

        muya.undo();
        expect(muya.getMarkdown()).toContain('seconXd');
        expect(muya.editor.selection.getSelectionState()?.anchor.offset).toBe(0);
        muya.undo();
        expect(muya.getMarkdown()).toContain('second');
        expect(muya.editor.selection.getSelectionState()?.anchor.offset).toBe(5);
    });
});
