// @vitest-environment happy-dom

import type { TState } from '../types';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// #5373: a batch of edits that failed to apply to the json state (the tree and
// the json state had drifted, as in #4903 / #5148) stayed queued, so every later
// flush composed it again and threw: nothing edited afterwards reached the
// saved document until the file was reopened.

const hosts: HTMLElement[] = [];
beforeEach(() => {
    window.MUYA_VERSION = 'test';
});
afterEach(() => {
    while (hosts.length)
        hosts.pop()!.remove();
    document.getSelection()?.removeAllRanges();
});

function boot(markdown: string): Muya {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const muya = new Muya(host, { markdown } as ConstructorParameters<typeof Muya>[1]);
    muya.init();
    hosts.push(muya.domNode);
    return muya;
}

function treeState(muya: Muya): TState[] {
    const states: TState[] = [];
    muya.editor.scrollPage!.forEach((block) => {
        if (block.isParent())
            states.push(block.getState());
    });
    return states;
}

// The json state loses the second block while the editor still shows it, the
// drift a wrong removal op leaves behind.
function bootDrifted(): Muya {
    const muya = boot('first\n\nsecond\n');
    muya.editor.jsonState.removeOperation([1]);
    muya.flush();
    expect(muya.getMarkdown()).toBe('first\n');
    return muya;
}

describe('a batch that fails to apply does not block later edits', () => {
    it('keeps saving edits made after the failure, and saves what the editor shows', () => {
        const muya = bootDrifted();
        const { scrollPage } = muya.editor;

        scrollPage!.lastContentInDescendant()!.text = 'second edited';
        expect(() => muya.flush()).toThrow();

        scrollPage!.firstContentInDescendant()!.text = 'first edited';
        expect(() => muya.flush()).not.toThrow();

        expect(muya.getMarkdown()).toBe('first edited\n\nsecond edited\n');
        expect(muya.getState()).toEqual(treeState(muya));
    });

    it('emits a json-change for the recovered document', () => {
        const muya = bootDrifted();
        const saved: string[] = [];
        muya.eventCenter.on('json-change', () => saved.push(muya.getMarkdown()));

        muya.editor.scrollPage!.lastContentInDescendant()!.text = 'second edited';
        expect(() => muya.flush()).toThrow();

        expect(saved).toEqual(['first\n\nsecond edited\n']);
    });

    it('undo and redo step over the recovery and keep the editor and json state in sync', () => {
        const muya = bootDrifted();
        const { scrollPage } = muya.editor;

        scrollPage!.lastContentInDescendant()!.text = 'second edited';
        expect(() => muya.flush()).toThrow();
        scrollPage!.firstContentInDescendant()!.text = 'first edited';
        muya.flush();

        muya.undo();
        expect(muya.getMarkdown()).toBe('first\n\nsecond edited\n');
        expect(muya.getState()).toEqual(treeState(muya));

        // The recovery is one step back to the json state from before it.
        muya.undo();
        expect(muya.getMarkdown()).toBe('first\n');
        expect(muya.getState()).toEqual(treeState(muya));

        muya.redo();
        muya.redo();
        expect(muya.getMarkdown()).toBe('first edited\n\nsecond edited\n');
        expect(muya.getState()).toEqual(treeState(muya));
    });
});
