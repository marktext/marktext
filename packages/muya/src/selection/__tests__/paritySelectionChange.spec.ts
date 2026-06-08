// @vitest-environment happy-dom

import type Content from '../../block/base/content';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Muya } from '../../muya';

// PARITY SCOREBOARD — gap PG1 (file PG01).
//
// Legacy `packages/muyajs` emitted `selectionChange` with an `affiliation`
// chain of the ancestor PARAGRAPH-type blocks plus per-block `.type` (the
// markdown block type: `h1`, `p`, `pre`, …) and `.functionType`
// (`codeContent`, `cellContent`, …). The desktop store
// (`createApplicationMenuState`) consumed those to light up the Paragraph-menu
// check marks, the Loose/Task-list toggles, table/code-fence detection, and to
// disable the Format menu inside code.
//
// `@muyajs/core`'s `selection-change` payload exposes only flat caret/range
// info: { anchor, focus, anchorBlock, anchorPath, focusBlock, focusPath,
// isCollapsed, isSelectionInSameBlock, direction, type, selectedImage,
// cursorCoords, formats }. There is NO `affiliation` ancestor chain, and
// `type` is the selection kind ('Caret' | 'Range'), never the block markdown
// type. Net effect: the native Paragraph/Format menu state is dead.
//
// These tests assert the DESIRED (pre-migration) shape — they are expected to
// FAIL today. When the engine restores the ancestor affiliation / block-type
// info, drop the `.fails`.

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
    // `document`-level keydown/click handlers registered by selection — and
    // removes the host node, so listeners don't leak across tests.
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

function emitSelectionFor(muya: Muya, content: Content): Record<string, unknown> {
    let payload: Record<string, unknown> | null = null;
    muya.on('selection-change', (p: unknown) => {
        payload = p as Record<string, unknown>;
    });
    muya.editor.selection.setSelection({
        anchor: { offset: 0 },
        focus: { offset: 0 },
        block: content,
        path: content.path,
    } as Parameters<typeof muya.editor.selection.setSelection>[0]);
    if (!payload)
        throw new Error('selection-change was not emitted');
    return payload;
}

describe('parity PG1: selection-change block affiliation', () => {
    it.fails(
        'PG1: selection-change payload exposes the ancestor block affiliation chain',
        () => {
            const muya = bootMuya('# Heading\n\nbody\n');
            const heading = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, heading);

            // Desired: the payload carries an `affiliation` map/list of the
            // ancestor block types so the desktop Paragraph menu can light up.
            // Today the key is entirely absent.
            expect('affiliation' in payload).toBe(true);
        },
    );

    it.fails(
        'PG1: selection-change exposes the current block markdown type (h1), not just the selection kind',
        () => {
            const muya = bootMuya('# Heading\n\nbody\n');
            const heading = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, heading);

            // Desired: a consumer can learn the cursor sits in an `h1` heading
            // (so `heading1MenuItem` can be checked). Today `type` is the
            // selection kind 'Caret' / 'Range' and no field reports `h1`.
            const flat = JSON.stringify(payload);
            expect(flat).toContain('h1');
        },
    );
});
