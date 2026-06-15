// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for the undo-history serialization API added for the
// muyajs -> @muyajs/core desktop migration: getHistory / setHistory /
// clearHistory. The desktop shell persists each tab's undo/redo history
// across tab switches — it reads getHistory() before deactivating a tab and
// restores it via setHistory() when the tab is re-selected.
//
// Block-tree mutations dispatch json1 ops that flow through the History
// recorder on the next animation frame (see JSONState._emitStateChange and
// History._record), so assertions on getState()/getMarkdown() and on the
// recorded stacks are wrapped in vi.waitFor to await that flush.
//
// History._record coalesces ops recorded within `options.delay` (1s) of the
// previous one into a single undo entry, so tests call `cutoff()` between
// edits to force one undo entry per edit and keep stack-depth assertions
// deterministic. The live-DOM selection that History reads while applying an
// undo can point at a block removed by the re-render, so we re-seat the
// cursor on a known-attached block right before each undo()/redo().

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
// directly to simulate the cursor sitting in the first block, and seat the
// live DOM caret there so History reads a valid selection.
function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    first.setCursor(0, 0, true);
    return first;
}

// Undo entries coalesce within options.delay; cutoff() forces the next edit
// into its own undo entry so depth assertions are deterministic.
function undoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.undo.length;
}

describe('muya history serialization api', () => {
    it('getHistory() returns a JSON-serializable snapshot of the undo/redo stacks', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('after', 'one');
        await vi.waitFor(() => {
            expect(undoDepth(muya)).toBe(1);
        });

        const snapshot = muya.getHistory();
        // It must survive a JSON round-trip with no loss (no live block refs,
        // functions, or DOM nodes leaking into the serialized form).
        expect(() => JSON.stringify(snapshot)).not.toThrow();
        expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);

        expect(snapshot.stack.undo).toHaveLength(1);
        expect(snapshot.stack.redo).toHaveLength(0);
        // The recorded selection is path-only — no live anchorBlock / focusBlock.
        const recorded = snapshot.stack.undo[0];
        expect(Array.isArray(recorded.operation)).toBe(true);
        if (recorded.selection) {
            expect(recorded.selection).not.toHaveProperty('anchorBlock');
            expect(recorded.selection).not.toHaveProperty('focusBlock');
            expect(Array.isArray(recorded.selection.anchor.path)).toBe(true);
        }
    });

    it('setHistory(getHistory()) then undo() reproduces the snapshot-point state', async () => {
        const muya = bootMuya('# Title\n');

        // Make two edits, capturing the markdown + a history snapshot after the
        // SECOND one — this is the state the desktop persists when a tab is
        // deactivated (document + undo stack both at the same point).
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('after', 'one');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('one');
            expect(undoDepth(muya)).toBe(1);
        });
        muya.editor.history.cutoff();
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('after', 'two');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('two');
            expect(undoDepth(muya)).toBe(2);
        });

        const snapshot = muya.getHistory();
        expect(snapshot.stack.undo).toHaveLength(2);

        // Simulate the tab round-trip: the in-memory history is dropped (as it
        // is when another tab takes over the editor) while the document stays
        // put, then the persisted snapshot is restored.
        muya.clearHistory();
        expect(undoDepth(muya)).toBe(0);
        muya.setHistory(snapshot);
        expect(undoDepth(muya)).toBe(2);

        // Undoing twice against the restored stack must walk the document back
        // through "two" then "one" to the original "# Title" — proving the
        // restored ops reproduce the prior document states losslessly.
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            const md = muya.getMarkdown();
            expect(md).toContain('one');
            expect(md).not.toContain('two');
        });
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('# Title');
        });
        expect(muya.editor.history.canUndo()).toBe(false);
        expect(muya.editor.history.canRedo()).toBe(true);
    });

    it('restored history round-trips through redo() back to the snapshot state', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('after', 'alpha');
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('alpha');
            expect(undoDepth(muya)).toBe(1);
        });
        const markdownAtSnapshot = muya.getMarkdown();
        // Persist exactly as the desktop shell would — through JSON.
        const snapshot = JSON.parse(JSON.stringify(muya.getHistory()));

        muya.setHistory(snapshot);
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('# Title');
        });

        // redo must restore the exact pre-undo document state, proving the
        // serialized op is lossless in both directions.
        placeCursorOnFirstBlock(muya);
        muya.redo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe(markdownAtSnapshot);
        });
    });

    it('clearHistory() empties both stacks', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('after', 'one');
        await vi.waitFor(() => {
            expect(undoDepth(muya)).toBe(1);
        });

        muya.clearHistory();
        expect(muya.editor.history.canUndo()).toBe(false);
        expect(muya.editor.history.canRedo()).toBe(false);
        expect(muya.getHistory().stack.undo).toHaveLength(0);
        expect(muya.getHistory().stack.redo).toHaveLength(0);
    });
});
