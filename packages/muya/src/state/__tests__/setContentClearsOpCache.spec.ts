// @vitest-environment happy-dom

import type { Muya } from '../../muya';
import type { TState } from '../types';
import { describe, expect, it } from 'vitest';
import JSONState from '../index';

// #2938: switching files (setContent) within the same frame as a pending edit
// left the previous document's deferred op batch in the cache. The scheduled
// requestAnimationFrame then applied that op to the NEW document's state,
// corrupting it (or throwing and freezing `_isGoing`), which broke saving the
// switched-to file. setContent must drop the pending batch and cancel its
// scheduled flush.

function makeState(blocks: TState[]): JSONState {
    const muya = {
        options: {
            footnote: false,
            isGitlabCompatibilityEnabled: false,
            trimUnnecessaryCodeBlockEmptyLines: false,
            frontMatter: false,
            math: false,
            listIndentation: 1,
        },
        eventCenter: { emit: () => {} },
    } as unknown as Muya;
    return new JSONState(muya, blocks);
}

function nextFrame(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe('setContent drops the previous document pending op batch (#2938)', () => {
    it('a deferred op from the old doc does not corrupt the new content after a tab switch', async () => {
        const state = makeState([{ name: 'paragraph', text: 'A' }]);

        // Pending edit against doc A (insert a block at index 1), not yet flushed.
        state.insertOperation([1], { name: 'paragraph', text: 'STALE' });

        // Switch to doc B within the same frame.
        state.setContent([
            { name: 'paragraph', text: 'B1' },
            { name: 'paragraph', text: 'B2' },
        ]);

        // Let the (cancelled) rAF window elapse.
        await nextFrame();
        await nextFrame();

        const texts = (state.getState() as Array<{ text: string }>).map(b => b.text);
        // The stale insert must NOT have been applied to doc B.
        expect(texts).toEqual(['B1', 'B2']);
    });

    it('edits after a setContent still flush normally', async () => {
        const state = makeState([{ name: 'paragraph', text: 'A' }]);
        state.insertOperation([1], { name: 'paragraph', text: 'STALE' });
        state.setContent([{ name: 'paragraph', text: 'B' }]);
        await nextFrame();

        // A fresh op against doc B applies cleanly (not frozen by a stuck _isGoing).
        state.insertOperation([1], { name: 'paragraph', text: 'C' });
        await nextFrame();
        await nextFrame();

        const texts = (state.getState() as Array<{ text: string }>).map(b => b.text);
        expect(texts).toEqual(['B', 'C']);
    });
});
