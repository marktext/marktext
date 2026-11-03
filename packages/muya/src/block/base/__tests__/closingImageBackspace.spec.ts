// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest';
import { bootMuya, useMuyaHarness } from '../../../__tests__/muyaHarness';

useMuyaHarness();

describe('backspace after a closing image tag', () => {
    it.each([
        'x </img>',
        'x </IMG >',
        '![keep](https://example.com/keep.png) x </img>',
        'x <img src="https://example.com/keep.png"> </img>',
    ])('deletes text without selecting an image in %j', (markdown) => {
        const muya = bootMuya(markdown);
        const block = muya.editor.scrollPage!.firstContentInDescendant()!;
        block.setCursor(block.text.length, block.text.length, true);

        const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
        block.backspaceHandler(event);
        muya.flush();

        expect(muya.getSelectionState()?.kind).toBe('text');
        expect(muya.getMarkdown()).toBe(`${markdown.slice(0, -1)}\n`);
    });
});
