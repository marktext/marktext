// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../__tests__/muyaHarness';
import Format from '../../block/base/format';
import { createTextSelectionState } from '../../selection/state';
import { getImageInfo } from '../../utils/image';

useMuyaHarness();

const source = 'before\n\n[first](/one "first title")\n\n[second](/two "second 😀 title")\n';

describe('selection restoration during block replay', () => {
    it('clears replaced image wrappers when restoring text without clearing another editor’s selection', () => {
        const markdown = 'before ![alt](https://example.test/a.png) after\n';
        const muya = bootMuya(markdown);
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        if (!(block instanceof Format))
            throw new Error('Expected a formattable image block');
        block.setCursor(block.text.length, block.text.length, true);
        muya.transact(() => {
            block.text += 'X';
            block.setCursor(block.text.length, block.text.length, true);
        });
        const wrapper = block.domNode!.querySelector<HTMLElement>('.mu-inline-image')!;
        muya.editor.selection.selectImage({ ...getImageInfo(wrapper), block });

        const other = bootMuya(markdown);
        const otherBlock = other.editor.scrollPage!.firstContentInDescendant()!;
        if (!(otherBlock instanceof Format))
            throw new Error('Expected a formattable image block');
        const otherWrapper = otherBlock.domNode!.querySelector<HTMLElement>('.mu-inline-image')!;
        other.editor.selection.selectImage({ ...getImageInfo(otherWrapper), block: otherBlock });

        muya.undo();

        expect(muya.getMarkdown()).toBe(markdown);
        expect(muya.getSelectionState()?.kind).toBe('text');
        expect(muya.domNode.querySelector('.mu-inline-image-selected')).toBeNull();
        expect(otherWrapper.classList.contains('mu-inline-image-selected')).toBe(true);
    });

    it.each([false, true])('reveals saved cross-block endpoints independently of the old native range (backward: %s)', (backward) => {
        const muya = bootMuya(source);
        const before = muya.editor.scrollPage!.firstContentInDescendant()!;
        const first = before.nextContentInContext()!;
        const second = first.nextContentInContext()!;
        const anchor = { block: first, path: first.path, offset: first.text.indexOf('title') + 2 };
        const focus = { block: second, path: second.path, offset: second.text.indexOf('title') + 2 };
        const state = createTextSelectionState(backward ? focus : anchor, backward ? anchor : focus);
        before.setCursor(0, 0, true);

        muya.editor.replayContents(null, state, true);

        expect(muya.getSelectionState()).toEqual(state);
        const native = document.getSelection()!;
        for (const node of [native.anchorNode!, native.focusNode!]) {
            const element = node instanceof Element ? node : node.parentElement!;
            expect(element.closest('.mu-hide')).toBeNull();
        }
    });

    it.each(['out of bounds', 'split surrogate pair'])('falls back without exposing syntax for an invalid snapshot: %s', (invalid) => {
        const muya = bootMuya(source);
        const before = muya.editor.scrollPage!.firstContentInDescendant()!;
        const first = before.nextContentInContext()!;
        const second = first.nextContentInContext()!;
        const state = createTextSelectionState(
            { block: first, path: first.path, offset: first.text.indexOf('title') },
            { block: second, path: second.path, offset: invalid === 'out of bounds' ? 1000 : second.text.indexOf('😀') + 1 },
        );

        muya.editor.replayContents(null, state, true);

        const restored = muya.editor.scrollPage!.firstContentInDescendant()!;
        expect(muya.getSelectionState()).toEqual(createTextSelectionState(
            { block: restored, path: restored.path, offset: 0 },
            { block: restored, path: restored.path, offset: 0 },
        ));
        for (const block of [restored.nextContentInContext()!, restored.nextContentInContext()!.nextContentInContext()!])
            expect(block.domNode!.querySelector('.mu-gray')).toBeNull();
    });

    it('applies an ordinary selection without replacing the block DOM', () => {
        const muya = bootMuya(source);
        const block = muya.editor.scrollPage!.firstContentInDescendant()!.nextContentInContext()!;
        muya.editor.activeContentBlock = block;
        block.update();
        const syntax = block.domNode!.querySelector('.mu-hide')!;
        const endpoint = { block, path: block.path, offset: block.text.indexOf('title') };
        const state = createTextSelectionState(endpoint, endpoint);

        const restored = muya.setSelection(state);

        expect(restored).toBe(true);
        expect(muya.getSelectionState()).toEqual(state);
        expect(syntax.isConnected).toBe(true);
        expect(syntax.classList.contains('mu-hide')).toBe(true);
    });
});
