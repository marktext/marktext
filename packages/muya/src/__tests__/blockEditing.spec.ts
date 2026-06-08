// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for the programmatic block-editing API added for the
// muyajs -> @muyajs/core desktop migration: duplicate / insertParagraph /
// deleteParagraph. These drive the desktop Edit/Paragraph menu actions,
// which previously had no public entrypoint on @muyajs/core.
//
// Block-tree mutations dispatch json1 ops that flush to the document state on
// the next animation frame (see JSONState._emitStateChange), so assertions on
// getState() are wrapped in vi.waitFor to await that flush.

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

// Block-level ops resolve their target via the active content block's
// outMostBlock — the way the editor tracks the cursor after a click. Set it
// directly to simulate the cursor sitting in the first block.
function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    return first;
}

describe('muya block editing api', () => {
    it('duplicate() copies the current block in place', async () => {
        const muya = bootMuya('# Title\n\nbody\n');
        placeCursorOnFirstBlock(muya);
        muya.duplicate();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(3);
            expect(after[0].name).toBe('atx-heading');
            expect(after[1].name).toBe('atx-heading');
            expect(after[2].name).toBe('paragraph');
        });
    });

    it('insertParagraph() inserts an empty paragraph after by default', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(2);
            expect(after[0].name).toBe('atx-heading');
            expect(after[1].name).toBe('paragraph');
        });
    });

    it('insertParagraph("before", text) inserts before with the given text', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('before', 'intro');
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(2);
            expect(after[0].name).toBe('paragraph');
            expect(after[1].name).toBe('atx-heading');
        });
        expect(muya.getMarkdown()).toContain('intro');
    });

    it('deleteParagraph() removes the current block and keeps the rest', async () => {
        const muya = bootMuya('# Title\n\nbody\n');
        placeCursorOnFirstBlock(muya);
        muya.deleteParagraph();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(1);
            expect(after[0].name).toBe('paragraph');
        });
    });

    it('deleteParagraph() on the only block leaves a single empty paragraph', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.deleteParagraph();
        await vi.waitFor(() => {
            const after = muya.getState();
            expect(after.length).toBe(1);
            expect(after[0].name).toBe('paragraph');
        });
    });
});
