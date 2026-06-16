import type Content from '../../block/base/content';
import type Parent from '../../block/base/parent';
import type { TState } from '../../state/types';
import { describe, expect, it } from 'vitest';
import { mergePasteIntoHeading } from '../mergePasteIntoHeading';

// Narrow casts shared by every test below. The helper under test only
// touches `text` / `update()` on the anchor and `blockName` on the wrapper,
// so the fake objects intentionally don't satisfy the full Content / Parent
// surface — `as unknown as Content` (etc.) makes the assertion explicit.
function asContent(block: IFakeContent): Content {
    return block as unknown as Content;
}
function asParentWithBlockName(blockName: string): Parent {
    return { blockName } as unknown as Parent;
}

// Regression for marktext commit 1c42555a (#671):
// "allow pasting multi-line text into a heading".
//
// Old behaviour: pasting multi-paragraph markdown into a heading kept the
// heading untouched and inserted ALL paragraphs as new blocks below.
// Expected behaviour: the first paragraph is merged into the heading (so
// the heading still feels like one continuous line at the cursor position),
// and the remaining paragraphs become regular paragraph blocks below the
// heading.
//
// `mergePasteIntoHeading` is the pure helper that decides whether to merge
// and, if so, mutates the heading's text and returns the remaining states.

interface IFakeContent {
    text: string;
    updated: boolean;
    update: () => void;
}

function content(text: string): IFakeContent {
    const block: IFakeContent = {
        text,
        updated: false,
        update() {
            this.updated = true;
        },
    };
    return block;
}

describe('mergePasteIntoHeading', () => {
    it('merges first paragraph state into an atx heading and returns the rest', () => {
        const heading = content('Title');
        const states = [
            { name: 'paragraph', text: 'Hello' },
            { name: 'paragraph', text: 'World' },
        ];

        const remaining = mergePasteIntoHeading(
            asContent(heading),
            asParentWithBlockName('atx-heading'),
            states as TState[],
            { startOffset: 5, endOffset: 5 },
        );

        expect(heading.text).toBe('TitleHello');
        expect(heading.updated).toBe(true);
        expect(remaining).toEqual([{ name: 'paragraph', text: 'World' }]);
    });

    it('also merges into setext heading', () => {
        const heading = content('Title');
        const states = [
            { name: 'paragraph', text: 'Hello' },
            { name: 'paragraph', text: 'World' },
        ];

        const remaining = mergePasteIntoHeading(
            asContent(heading),
            asParentWithBlockName('setext-heading'),
            states as TState[],
            { startOffset: 5, endOffset: 5 },
        );

        expect(heading.text).toBe('TitleHello');
        expect(remaining).toEqual([{ name: 'paragraph', text: 'World' }]);
    });

    it('honours an existing selection on the heading by collapsing the selected range first', () => {
        const heading = content('Title XXX'); // user selected "XXX" before pasting
        const states = [
            { name: 'paragraph', text: 'Hello' },
            { name: 'paragraph', text: 'World' },
        ];

        const remaining = mergePasteIntoHeading(
            asContent(heading),
            asParentWithBlockName('atx-heading'),
            states as TState[],
            { startOffset: 6, endOffset: 9 },
        );

        expect(heading.text).toBe('Title Hello');
        expect(remaining).toEqual([{ name: 'paragraph', text: 'World' }]);
    });

    it('returns the original states unchanged when wrapper is not a heading', () => {
        const para = content('Foo');
        const states = [
            { name: 'paragraph', text: 'A' },
            { name: 'paragraph', text: 'B' },
        ];

        const remaining = mergePasteIntoHeading(
            asContent(para),
            asParentWithBlockName('paragraph'),
            states as TState[],
            { startOffset: 3, endOffset: 3 },
        );

        expect(para.text).toBe('Foo');
        expect(para.updated).toBe(false);
        expect(remaining).toBe(states);
    });

    it('returns the original states when first state is not a paragraph', () => {
        const heading = content('Title');
        const states = [
            { name: 'code-block', text: 'console.log()' },
            { name: 'paragraph', text: 'after' },
        ];

        const remaining = mergePasteIntoHeading(
            asContent(heading),
            asParentWithBlockName('atx-heading'),
            states as TState[],
            { startOffset: 5, endOffset: 5 },
        );

        expect(heading.text).toBe('Title');
        expect(heading.updated).toBe(false);
        expect(remaining).toBe(states);
    });

    it('returns an empty array when states is empty (no-op)', () => {
        const heading = content('Title');

        const remaining = mergePasteIntoHeading(
            asContent(heading),
            asParentWithBlockName('atx-heading'),
            [],
            { startOffset: 5, endOffset: 5 },
        );

        expect(heading.text).toBe('Title');
        expect(remaining).toEqual([]);
    });
});
