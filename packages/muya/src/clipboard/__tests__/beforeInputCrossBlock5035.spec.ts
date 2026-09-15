// @vitest-environment jsdom

import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { Muya } from '../../muya';
import type { TState } from '../../state/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya as MuyaClass } from '../../muya';

// #5035: the browser must not apply an edit to a selection that spans blocks
// by itself. Its DOM edit removes the block elements in between, those blocks
// stay in the block tree with detached DOM nodes, and the next edit that
// inserts next to one of them throws "Failed to execute 'insertBefore'".
//
// Each case dispatches `beforeinput` with no keydown in front of it, the way
// an emoji picker commit arrives, over a live DOM selection. jsdom rather than
// happy-dom because happy-dom collapses a selection that spans elements.

vi.mock('../../utils/prism/index', () => ({
    default: {},
    walkTokens: () => null,
    loadedLanguages: new Set(),
    transformAliasToOrigin: (s: string) => s,
    loadLanguage: () => Promise.resolve([]),
    search: () => [],
}));

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

function findContent(muya: Muya, text: string): Content {
    let block: Content | null = muya.editor.scrollPage!.firstContentInDescendant();
    while (block && block.text !== text)
        block = block.nextContentInContext() ?? null;
    if (!block)
        throw new Error(`no content block with text "${text}"`);
    return block;
}

function textNodeOf(content: Content): Text {
    const walker = document.createTreeWalker(content.domNode!, NodeFilter.SHOW_TEXT);
    return walker.nextNode() as Text;
}

function selectDom(anchorNode: Node, anchorOffset: number, focusNode: Node, focusOffset: number): void {
    // `ownsEvent()` only lets the handler act while focus is inside the editor.
    (anchorNode.parentElement!.closest('[contenteditable]') as HTMLElement).focus();
    document.getSelection()!.setBaseAndExtent(anchorNode, anchorOffset, focusNode, focusOffset);
}

function dispatchBeforeInput(target: Node, inputType: string, data: string | null = null): InputEvent {
    const event = new InputEvent('beforeinput', { inputType, data, bubbles: true, cancelable: true });
    target.dispatchEvent(event);
    return event;
}

function treeState(muya: Muya): TState[] {
    const states: TState[] = [];
    muya.editor.scrollPage!.forEach(block => states.push((block as Parent).getState()));
    return states;
}

function flushedMarkdown(muya: Muya): string {
    muya.editor.jsonState.flush();
    return muya.getMarkdown();
}

function detachedBlocks(muya: Muya): string[] {
    const detached: string[] = [];
    muya.editor.scrollPage!.depthFirstTraverse((block) => {
        if (!block.domNode?.isConnected)
            detached.push(block.blockName);
    });
    return detached;
}

describe('beforeinput over a selection that spans blocks (#5035)', () => {
    it('cuts the selection before the browser inserts committed text', () => {
        const muya = bootMuya('- one\n- two\n\ntext\n');
        const two = findContent(muya, 'two');
        const text = findContent(muya, 'text');
        selectDom(textNodeOf(two), 2, textNodeOf(text), 2);

        const event = dispatchBeforeInput(two.domNode!, 'insertText', 'é');

        expect(event.defaultPrevented).toBe(false);
        expect(flushedMarkdown(muya)).toBe('- one\n- twxt\n');
        expect(detachedBlocks(muya)).toEqual([]);
        expect(muya.editor.jsonState.getState()).toEqual(treeState(muya));

        const caret = muya.editor.selection.getSelection();
        expect(caret?.anchor.block.text).toBe('twxt');
        expect(caret?.isCollapsed).toBe(true);
        expect(caret?.anchor.offset).toBe(2);
    });

    it('cuts the selection and cancels a deletion, which the cut already made', () => {
        const muya = bootMuya('- one\n- two\n\ntext\n');
        const two = findContent(muya, 'two');
        const text = findContent(muya, 'text');
        selectDom(textNodeOf(text), 2, textNodeOf(two), 2);

        const event = dispatchBeforeInput(text.domNode!, 'deleteContentBackward');

        expect(event.defaultPrevented).toBe(true);
        expect(flushedMarkdown(muya)).toBe('- one\n- twxt\n');
        expect(detachedBlocks(muya)).toEqual([]);
    });

    it('leaves a selection inside one block to the browser', () => {
        const muya = bootMuya('- one\n- two\n\ntext\n');
        const text = findContent(muya, 'text');
        selectDom(textNodeOf(text), 1, textNodeOf(text), 3);

        const event = dispatchBeforeInput(text.domNode!, 'insertText', 'é');

        expect(event.defaultPrevented).toBe(false);
        expect(flushedMarkdown(muya)).toBe('- one\n- two\n\ntext\n');
    });

    it('does not cut for an input that neither inserts nor deletes', () => {
        const muya = bootMuya('- one\n- two\n\ntext\n');
        const two = findContent(muya, 'two');
        const text = findContent(muya, 'text');
        selectDom(textNodeOf(two), 2, textNodeOf(text), 2);

        dispatchBeforeInput(two.domNode!, 'formatBold');

        expect(flushedMarkdown(muya)).toBe('- one\n- two\n\ntext\n');
    });
});
