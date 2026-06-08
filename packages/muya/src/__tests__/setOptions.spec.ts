// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for the runtime option API added for the muyajs -> @muyajs/core
// migration: setOptions / setFont / setTabSize / setListIndentation. Every
// desktop Preferences toggle depends on options updating live. setOptions with
// forceRender re-renders from current state (so render-affecting options take
// effect) WITHOUT clearing undo history, and preserves the document content.

const bootedHosts: HTMLElement[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    while (bootedHosts.length) {
        const host = bootedHosts.pop()!;
        host.remove();
    }
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

describe('muya runtime options', () => {
    it('setOptions merges into muya.options', () => {
        const muya = bootMuya('hello\n');
        muya.setOptions({ footnote: true, superSubScript: false });
        expect(muya.options.footnote).toBe(true);
        expect(muya.options.superSubScript).toBe(false);
    });

    it('setOptions with forceRender preserves the document content', () => {
        const muya = bootMuya('# Heading\n\nsome text\n');
        const before = muya.getMarkdown();
        muya.setOptions({ footnote: true }, true);
        // A forced re-render rebuilds the block tree from current state, so the
        // serialized document is unchanged.
        expect(muya.getMarkdown()).toBe(before);
    });

    it('setOptions with forceRender does not clear the undo history', async () => {
        const muya = bootMuya('one\n');
        muya.editor.activeContentBlock = muya.editor.scrollPage!.firstContentInDescendant()!;
        // Make an edit so the undo stack is non-empty.
        muya.insertParagraph();
        await vi.waitFor(() => {
            expect(muya.getState().length).toBe(2);
            // the edit was recorded onto the undo stack
            expect(muya.editor.history.canUndo()).toBe(true);
        });

        // A forced re-render rebuilds the tree via ScrollPage.updateState, which
        // uses the 'api' source (no json-change dispatch), so it neither clears
        // the history (unlike setContent) nor pollutes it with re-render ops.
        muya.setOptions({ footnote: true }, true);

        expect(muya.editor.history.canUndo()).toBe(true);
    });

    it('setOptions reflects spellcheckEnabled on the container', () => {
        const muya = bootMuya('x\n');
        muya.setOptions({ spellcheckEnabled: true });
        expect(muya.domNode.getAttribute('spellcheck')).toBe('true');
        muya.setOptions({ spellcheckEnabled: false });
        expect(muya.domNode.getAttribute('spellcheck')).toBe('false');
    });

    it('setFont and setTabSize update options', () => {
        const muya = bootMuya('x\n');
        muya.setFont({ fontSize: 18, lineHeight: 1.8 });
        expect(muya.options.fontSize).toBe(18);
        expect(muya.options.lineHeight).toBe(1.8);
        muya.setTabSize(2);
        expect(muya.options.tabSize).toBe(2);
    });

    it('setListIndentation updates options and preserves content', () => {
        const muya = bootMuya('- a\n- b\n');
        const before = muya.getMarkdown();
        muya.setListIndentation(2);
        expect(muya.options.listIndentation).toBe(2);
        expect(muya.getMarkdown()).toBe(before);
    });
});
