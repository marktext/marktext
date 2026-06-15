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
    muya.editor.selection.setSelection(
        { offset: 0, block: content, path: content.path },
        { offset: 0, block: content, path: content.path },
    );
    if (!payload)
        throw new Error('selection-change was not emitted');
    return payload;
}

describe('parity PG1: selection-change block affiliation', () => {
    it(
        'PG1: selection-change payload exposes the ancestor block affiliation chain',
        () => {
            const muya = bootMuya('# Heading\n\nbody\n');
            const heading = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, heading);

            // The payload carries an `affiliation` list of the ancestor block
            // types so the desktop Paragraph menu can light up.
            expect('affiliation' in payload).toBe(true);
            expect(Array.isArray(payload.affiliation)).toBe(true);
        },
    );

    it(
        'PG1: selection-change exposes the current block markdown type (h1), not just the selection kind',
        () => {
            const muya = bootMuya('# Heading\n\nbody\n');
            const heading = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, heading);

            // A consumer can learn the cursor sits in an `h1` heading (so
            // `heading1MenuItem` can be checked) — the affiliation chain reports
            // the markdown block type, separate from the selection kind
            // (`type` stays 'Caret' / 'Range').
            const affiliation = payload.affiliation as Array<{ type: string }>;
            expect(affiliation.map(entry => entry.type)).toContain('h1');
            // The selection kind is still the flat caret/range type.
            expect(payload.type).toBe('Caret');
        },
    );

    it(
        'PG1: selection-change exposes per-endpoint content-leaf block info (type + functionType)',
        () => {
            const muya = bootMuya('```js\nconst a = 1\n```\n');
            // `firstContentInDescendant` of a code block is the language-input
            // leaf; the code text lives in the last content leaf.
            const codeLeaf = muya.editor.scrollPage!.lastContentInDescendant()!;
            const payload = emitSelectionFor(muya, codeLeaf);

            // The desktop store keys `isCodeFences` / `isCodeContent` off
            // `start.type === 'span' && block.functionType === 'codeContent'`.
            const info = payload.anchorBlockInfo as {
                type: string;
                functionType?: string;
            };
            expect(info.type).toBe('span');
            expect(info.functionType).toBe('codeContent');
            // The fenced code block contributes a `pre`-typed affiliation entry.
            const affiliation = payload.affiliation as Array<{ type: string }>;
            expect(affiliation.map(entry => entry.type)).toContain('pre');
        },
    );

    it(
        'PG1: selection-change surfaces list context (ul / li / loose / task) in affiliation',
        () => {
            const muya = bootMuya('- [ ] task\n');
            const leaf = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, leaf);
            const affiliation = payload.affiliation as Array<{
                type: string;
                listType?: string;
                listItemType?: string;
                isLooseListItem?: boolean;
            }>;
            const list = affiliation.find(entry => entry.type === 'ul');
            const item = affiliation.find(entry => entry.type === 'li');

            expect(list).toBeTruthy();
            expect(list!.listType).toBe('task');
            expect(list!.isLooseListItem).toBe(false);
            expect(item).toBeTruthy();
            expect(item!.listItemType).toBe('task');
        },
    );

    it(
        'PG1: ordered-list items report listItemType "order" (not misclassified as bullet)',
        () => {
            const muya = bootMuya('1. one\n2. two\n');
            const leaf = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, leaf);
            const affiliation = payload.affiliation as Array<{
                type: string;
                listType?: string;
                listItemType?: string;
            }>;

            expect(affiliation.find(e => e.type === 'ol')?.listType).toBe('order');
            // Bullet and ordered lists share the `list-item` block; the item's
            // discriminator must come from the parent list.
            expect(affiliation.find(e => e.type === 'li')?.listItemType).toBe('order');
        },
    );

    it(
        'PG1: loose lists report isLooseListItem true on both the list and the item',
        () => {
            // Blank lines between items make a loose list.
            const muya = bootMuya('- one\n\n- two\n');
            const leaf = muya.editor.scrollPage!.firstContentInDescendant()!;
            const payload = emitSelectionFor(muya, leaf);
            const affiliation = payload.affiliation as Array<{
                type: string;
                isLooseListItem?: boolean;
            }>;

            // Loose-ness lives on the list block; the `li` entry mirrors it.
            expect(affiliation.find(e => e.type === 'ul')?.isLooseListItem).toBe(true);
            expect(affiliation.find(e => e.type === 'li')?.isLooseListItem).toBe(true);
        },
    );
});
