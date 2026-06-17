// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// PARITY SCOREBOARD — gap PG13 (file PG11/PG13, "insert-paragraph anchor").
//
// Legacy `packages/muyajs` `insertParagraph(location, text, outMost=false)`
// chose the insertion anchor via `getAnchor(block)` (the IMMEDIATE enclosing
// block) for the context-menu / Paragraph-menu Insert-Paragraph path, and only
// used `findOutMostBlock` for the explicit "Create Paragraph Below" action. So
// inserting a paragraph while the cursor sat inside a list item / blockquote
// landed the new paragraph as an inner sibling, INSIDE the structure.
//
// `@muyajs/core`'s `insertParagraph(location, text)` originally ALWAYS resolved
// the target via `_outmostBlockAtCursor()` → `outMostBlock` (the OUTERMOST
// container), so in a nested list/blockquote the new paragraph landed AFTER the
// entire outer block (at document root) instead of as an inner sibling.
//
// The engine now restores the immediate-anchor path: `insertParagraph` gained a
// third `outMost` flag (default `false`) that anchors to the IMMEDIATE block at
// the cursor, matching the legacy context-menu "Insert Paragraph Before/After"
// behaviour. The explicit "Create Paragraph Below" caller passes `outMost=true`
// to keep anchoring at the outermost container. These specs assert the restored
// immediate-anchor behaviour and now PASS.

const bootedMuyas: Muya[] = [];
let originalVersion: string | undefined;
let hadVersion = false;

beforeEach(() => {
    hadVersion = 'MUYA_VERSION' in window;
    originalVersion = window.MUYA_VERSION;
    window.MUYA_VERSION = 'test';
});

afterEach(() => {
    // `destroy()` detaches the engine's DOM listeners — including the
    // `document`-level handlers registered during init — and removes the host
    // node, so listeners don't leak across tests.
    while (bootedMuyas.length)
        bootedMuyas.pop()!.destroy();
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
    bootedMuyas.push(muya);
    return muya;
}

// Find the leaf content block whose text matches `text` and place the cursor on
// it (the way a click sets `activeContentBlock`).
function placeCursorOn(muya: Muya, text: string): Content {
    let target: Content | null = null;
    const visit = (block: { text?: string; constructor: { blockName?: string }; children?: { forEach: (cb: (b: unknown) => void) => void } }) => {
        if (
            (block.constructor as { blockName?: string }).blockName?.endsWith('.content')
            && block.text === text
        ) {
            target = block as unknown as Content;
        }
        block.children?.forEach(b => visit(b as typeof block));
    };
    visit(muya.editor.scrollPage as unknown as Parameters<typeof visit>[0]);
    if (!target)
        throw new Error(`content block with text "${text}" not found`);
    muya.editor.activeContentBlock = target;
    return target;
}

interface IStateNode { name: string; text?: string; children?: IStateNode[] }

// Does any block at the TOP level of the document carry this text directly?
function topLevelHasParagraph(muya: Muya, text: string): boolean {
    return (muya.getState() as unknown as IStateNode[]).some(
        node => node.name === 'paragraph' && node.text === text,
    );
}

// Is the text present anywhere in the (nested) document state?
function existsAnywhere(muya: Muya, text: string): boolean {
    return JSON.stringify(muya.getState()).includes(text);
}

describe('parity PG13: insertParagraph anchors to the immediate block in nested structures', () => {
    it(
        'PG13: inserting after a nested list item keeps the new paragraph inside the list, not at document root',
        async () => {
            const muya = bootMuya('- outer\n\n  - inner1\n  - inner2\n');
            placeCursorOn(muya, 'inner1');

            muya.insertParagraph('after', 'INNERSIBLING');

            await vi.waitFor(() => {
                expect(existsAnywhere(muya, 'INNERSIBLING')).toBe(true);
            });

            // Desired: the new paragraph is an INNER sibling — the top-level
            // block count is unchanged (still just the one bullet-list) and the
            // paragraph is NOT a root-level sibling. Today it lands at root.
            expect(muya.getState().length).toBe(1);
            expect(topLevelHasParagraph(muya, 'INNERSIBLING')).toBe(false);
        },
    );

    it(
        'PG13: inserting after a paragraph inside a blockquote stays inside the blockquote',
        async () => {
            const muya = bootMuya('> quoted line\n');
            placeCursorOn(muya, 'quoted line');

            muya.insertParagraph('after', 'QUOTESIBLING');

            await vi.waitFor(() => {
                expect(existsAnywhere(muya, 'QUOTESIBLING')).toBe(true);
            });

            // Desired: still a single top-level block (the blockquote) with the
            // new paragraph nested inside it. Today it lands after the quote at
            // document root.
            expect(muya.getState().length).toBe(1);
            expect(muya.getState()[0].name).toBe('block-quote');
            expect(topLevelHasParagraph(muya, 'QUOTESIBLING')).toBe(false);
        },
    );
});
