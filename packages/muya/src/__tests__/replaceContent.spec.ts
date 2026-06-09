// @vitest-environment happy-dom

import type Content from '../block/base/content';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Muya } from '../muya';

// Coverage for `Muya.replaceContent` — the single-undo-boundary whole-document
// replacement used when the desktop shell hands a tab back from source-code
// mode (parity gap PG14). The first `undo()` after a bulk replacement must
// revert the ENTIRE change in one step, and `redo()` must re-apply it; both
// directions rebuild the block tree wholesale (ScrollPage.updateState) rather
// than walking it incrementally, so arbitrary block-type changes round-trip
// without desyncing the live DOM from the authoritative json state.
//
// Each case asserts on `getMarkdown()` (the authoritative json state) AND on a
// fresh `setContent` of the same target (the ground-truth DOM) so a walker that
// silently desynced the tree would be caught: `domHtml()` of the rebuilt tree
// must equal the ground truth.

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

function placeCursorOnFirstBlock(muya: Muya): Content {
    const first = muya.editor.scrollPage!.firstContentInDescendant()!;
    muya.editor.activeContentBlock = first;
    first.setCursor(0, 0, true);
    return first;
}

// Normalize the editor DOM for structural comparison: drop the volatile
// attributes (ids, keys, classes, contenteditable flags) and zero-width
// markers so two trees built from the same state compare equal.
function domHtml(muya: Muya): string {
    const clone = muya.domNode.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('*').forEach((el) => {
        el.removeAttribute('id');
        el.removeAttribute('data-key');
        el.removeAttribute('class');
        el.removeAttribute('contenteditable');
        el.removeAttribute('spellcheck');
        el.removeAttribute('style');
    });
    return clone.innerHTML.replace(/\u200B/g, '').replace(/\s+/g, ' ').trim();
}

// Build a detached ground-truth tree for `markdown` and return both its
// canonical (engine-rendered) markdown and its normalized DOM — what the live
// tree MUST look like after a replaceContent / undo / redo settles on the same
// content. The engine re-renders some constructs canonically (e.g. table cell
// padding), so the target is compared against the engine's own output, not the
// raw source string.
function groundTruth(markdown: string): { md: string; dom: string } {
    const muya = bootMuya(markdown);
    return { md: muya.getMarkdown(), dom: domHtml(muya) };
}

function undoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.undo.length;
}

function redoDepth(muya: Muya): number {
    // @ts-expect-error — reach into the private stack for test assertions.
    return muya.editor.history._stack.redo.length;
}

const cases: Array<[string, string, string]> = [
    ['paragraph add block', 'base\n', 'base\n\nSOURCE ADDED LINE\n'],
    ['paragraph -> heading', 'hello\n', '# hello\n'],
    ['heading -> paragraph', '# hello\n', 'hello\n'],
    ['paragraph -> bullet list', 'item\n', '- item\n'],
    ['list add item', '- a\n- b\n', '- a\n- b\n- c\n'],
    ['list remove item', '- a\n- b\n- c\n', '- a\n- c\n'],
    ['list nest', '- a\n- b\n', '- a\n  - b\n'],
    ['bullet -> ordered list', '- a\n- b\n', '1. a\n2. b\n'],
    ['paragraph -> table', 'x\n', '| a | b |\n| --- | --- |\n| 1 | 2 |\n'],
    ['paragraph -> code block', 'x\n', '```js\nconst a = 1\n```\n'],
    ['code block -> paragraph', '```js\nconst a = 1\n```\n', 'plain\n'],
    ['add frontmatter', 'body\n', '---\ntitle: x\n---\n\nbody\n'],
    ['remove frontmatter', '---\ntitle: x\n---\n\nbody\n', 'body\n'],
    ['inline edit', 'hello world\n', 'hello WORLD\n'],
    ['inline emphasis added', 'plain text\n', 'plain **bold** text\n'],
    ['multi-block reorder', 'A\n\nB\n\nC\n', 'C\n\nA\n\nB\n'],
    ['delete middle block', 'A\n\nB\n\nC\n', 'A\n\nC\n'],
    ['blockquote', 'quote me\n', '> quote me\n'],
    [
        'mixed bulk replacement',
        '# Title\n\npara\n\n- l1\n- l2\n',
        '## Changed\n\nnew para\n\n1. ol1\n2. ol2\n\n```\ncode\n```\n',
    ],
    ['clear to single empty paragraph', 'A\n\nB\n', '\n'],
];

describe('muya replaceContent — single undo boundary', () => {
    it.each(cases)(
        'records ONE boundary and round-trips: %s',
        async (_name, before, after) => {
            const muya = bootMuya(before);
            await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe(before.trim()));
            placeCursorOnFirstBlock(muya);

            const beforeMd = muya.getMarkdown();
            const beforeDom = groundTruth(before).dom;
            const truth = groundTruth(after);

            // Forward replacement records exactly ONE undo boundary.
            const depthBefore = undoDepth(muya);
            const changed = muya.replaceContent(after);
            expect(changed).toBe(true);
            expect(undoDepth(muya)).toBe(depthBefore + 1);

            // Json state AND live DOM both reflect the new content.
            expect(muya.getMarkdown()).toBe(truth.md);
            expect(domHtml(muya)).toBe(truth.dom);

            // FIRST undo reverts the entire bulk change in one step.
            placeCursorOnFirstBlock(muya);
            muya.undo();
            await vi.waitFor(() => {
                expect(muya.getMarkdown()).toBe(beforeMd);
            });
            // Live DOM is restored too (catches a desynced incremental walker).
            expect(domHtml(muya)).toBe(beforeDom);
            expect(redoDepth(muya)).toBe(1);

            // redo re-applies the entire change in one step.
            placeCursorOnFirstBlock(muya);
            muya.redo();
            await vi.waitFor(() => {
                expect(muya.getMarkdown()).toBe(truth.md);
            });
            expect(domHtml(muya)).toBe(truth.dom);
        },
    );

    it('returns false and records nothing when content is unchanged', async () => {
        const muya = bootMuya('same\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('same'));
        const depth = undoDepth(muya);
        expect(muya.replaceContent('same\n')).toBe(false);
        expect(undoDepth(muya)).toBe(depth);
        expect(muya.getMarkdown().trim()).toBe('same');
    });

    it('remains lossless across repeated undo/redo toggles (remove-heavy op)', async () => {
        // A replacement that DELETES blocks exercises the `invert`-without-doc
        // path `_change` uses to repopulate the redo stack: the recorded undo op
        // must carry the removed block values so each toggle reproduces the exact
        // state. Toggle several times to catch any drift.
        const muya = bootMuya('A\n\nB\n\nC\n\nD\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('A\n\nB\n\nC\n\nD'));
        placeCursorOnFirstBlock(muya);

        const before = muya.getMarkdown();
        muya.replaceContent('A\n\nD\n'); // delete B and C
        const after = muya.getMarkdown();
        expect(after.trim()).toBe('A\n\nD');

        for (let i = 0; i < 3; i++) {
            placeCursorOnFirstBlock(muya);
            muya.undo();
            await vi.waitFor(() => expect(muya.getMarkdown()).toBe(before));

            placeCursorOnFirstBlock(muya);
            muya.redo();
            await vi.waitFor(() => expect(muya.getMarkdown()).toBe(after));
        }
    });

    it('does not mutate the stored undo-stack selection paths across replays', async () => {
        // Regression: applying a rebuild entry restores the caret via
        // Selection.setSelection -> _setCursor -> scrollPage.queryBlock(path),
        // and queryBlock drains the path array with shift(). The stored undo
        // entry's selection paths must survive repeated undo/redo replays (we
        // clone them before resolving), otherwise the second replay would query
        // an emptied path and lose the caret.
        const muya = bootMuya('first\n\nsecond\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('first\n\nsecond'));
        // Seat the caret in the SECOND block so the recorded selection has a
        // non-trivial path ([1, ...]) that would be visibly corrupted if drained.
        const second = muya.editor.scrollPage!.lastContentInDescendant()!;
        muya.editor.activeContentBlock = second;
        second.setCursor(0, 0, true);

        muya.replaceContent('first\n\nsecond\n\nthird\n');
        expect(undoDepth(muya)).toBe(1);

        // @ts-expect-error — reach into the private stack for assertions.
        const storedSel = muya.editor.history._stack.undo[0].selection;
        const pathLenBefore = storedSel?.anchorPath?.length ?? 0;
        expect(pathLenBefore).toBeGreaterThan(0);

        // Two full undo/redo cycles — each replay resolves the caret from paths.
        // Re-fetch a live block each iteration: the prior `second` ref is
        // detached after the rebuild and would crash on `.path` reads.
        for (let i = 0; i < 2; i++) {
            const live = muya.editor.scrollPage!.firstContentInDescendant()!;
            muya.editor.activeContentBlock = live;
            live.setCursor(0, 0, true);
            muya.undo();
            await vi.waitFor(() => expect(muya.getMarkdown()).not.toContain('third'));
            const live2 = muya.editor.scrollPage!.firstContentInDescendant()!;
            muya.editor.activeContentBlock = live2;
            live2.setCursor(0, 0, true);
            muya.redo();
            await vi.waitFor(() => expect(muya.getMarkdown()).toContain('third'));
        }

        // The stored selection's paths are untouched (not drained to []).
        // @ts-expect-error — private stack read.
        const after = muya.editor.history._stack;
        const finalSel = after.redo[0]?.selection ?? after.undo[0]?.selection;
        expect(finalSel?.anchorPath?.length ?? 0).toBeGreaterThan(0);
    });

    it('does not coalesce a later edit into the replacement boundary', async () => {
        const muya = bootMuya('base\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('base'));
        placeCursorOnFirstBlock(muya);

        muya.replaceContent('base\n\nADDED\n');
        expect(undoDepth(muya)).toBe(1);
        expect(muya.getMarkdown().trim()).toContain('ADDED');

        // A normal edit immediately afterwards must be its OWN boundary, even
        // within the History coalescing window (recordRebuild reset lastRecorded).
        const first = muya.editor.scrollPage!.firstContentInDescendant()!;
        muya.editor.activeContentBlock = first;
        first.setCursor(4, 4, true);
        muya.insertParagraph('after', 'typed');
        await vi.waitFor(() => {
            expect(undoDepth(muya)).toBe(2);
            expect(muya.getMarkdown()).toContain('typed');
        });

        // Undo only the typed edit — the replacement stays applied.
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).not.toContain('typed');
            expect(muya.getMarkdown()).toContain('ADDED');
        });

        // Second undo reverts the bulk replacement.
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('base');
        });
    });

    it('preserves the pre-existing undo stack beneath the boundary', async () => {
        const muya = bootMuya('# Title\n');
        placeCursorOnFirstBlock(muya);
        muya.insertParagraph('after', 'edit-one');
        await vi.waitFor(() => {
            expect(undoDepth(muya)).toBe(1);
            expect(muya.getMarkdown()).toContain('edit-one');
        });
        muya.editor.history.cutoff();

        // Bulk replacement on top of an existing 1-deep stack.
        placeCursorOnFirstBlock(muya);
        muya.replaceContent('completely different\n');
        expect(undoDepth(muya)).toBe(2);
        expect(muya.getMarkdown().trim()).toBe('completely different');

        // Undo the replacement: back to the post-edit-one document.
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toContain('edit-one');
            expect(muya.getMarkdown()).not.toContain('completely different');
        });

        // The earlier op is still undoable — back to the original title.
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('# Title');
        });
        expect(muya.editor.history.canUndo()).toBe(false);
    });

    it('replacement boundary survives getHistory / setHistory round-trip', async () => {
        const muya = bootMuya('start\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('start'));
        placeCursorOnFirstBlock(muya);

        muya.replaceContent('start\n\n## section\n\nrebuilt body\n');
        expect(undoDepth(muya)).toBe(1);
        const targetMd = muya.getMarkdown();

        // Persist through JSON exactly as the desktop shell does on tab switch.
        const snapshot = JSON.parse(JSON.stringify(muya.getHistory()));
        expect(snapshot.stack.undo[0].rebuild).toBe(true);

        muya.clearHistory();
        muya.setHistory(snapshot);
        expect(undoDepth(muya)).toBe(1);

        // Undo the restored rebuild boundary — reverts to the pre-replacement doc.
        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('start');
        });

        // redo reproduces the exact replacement target.
        placeCursorOnFirstBlock(muya);
        muya.redo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown()).toBe(targetMd);
        });
    });

    it('accepts a state array as well as markdown', async () => {
        const muya = bootMuya('one\n');
        await vi.waitFor(() => expect(muya.getMarkdown().trim()).toBe('one'));
        placeCursorOnFirstBlock(muya);

        const target = muya.editor.jsonState.markdownToState('# heading\n\ntwo\n');
        muya.replaceContent(target);
        expect(undoDepth(muya)).toBe(1);
        expect(muya.getMarkdown()).toContain('# heading');
        expect(muya.getMarkdown()).toContain('two');

        placeCursorOnFirstBlock(muya);
        muya.undo();
        await vi.waitFor(() => {
            expect(muya.getMarkdown().trim()).toBe('one');
        });
    });
});
