import type { IFoldKeyChord, IFoldSibling } from '../foldSection';
import { describe, expect, it } from 'vitest';
import { headingLevel, hiddenByFoldedSections, isFoldableHeading, isFoldShortcut } from '../foldSection';

function para(): IFoldSibling {
    return { blockName: 'paragraph' };
}

function heading(level: number, folded = false): IFoldSibling {
    return { blockName: 'atx-heading', level, folded };
}

describe('heading boundaries', () => {
    it.each(['atx-heading', 'setext-heading'])('reads the level of %s', (blockName) => {
        expect(headingLevel({ blockName, meta: { level: 2 } })).toBe(2);
    });

    it.each([null, undefined, { blockName: 'paragraph', meta: { level: 1 } }, { blockName: 'atx-heading' }, { blockName: 'setext-heading', meta: {} }])('ignores non-headings and missing levels: %j', (block) => {
        expect(headingLevel(block)).toBeUndefined();
        expect(isFoldableHeading(block)).toBe(false);
    });

    it('requires the full fold capability before narrowing a node', () => {
        const node = { blockName: 'atx-heading', meta: { level: 1 }, toggleFold() {} };
        expect(isFoldableHeading(node)).toBe(false);
        expect(isFoldableHeading({ ...node, folded: false })).toBe(true);
    });
});

describe('isFoldShortcut', () => {
    // Base chord = Ctrl+Shift+[ (the non-mac form). Individual tests flip one
    // field to prove each condition is actually required.
    const chord = (over: Partial<IFoldKeyChord> = {}): IFoldKeyChord => ({
        key: '[',
        code: 'BracketLeft',
        shiftKey: true,
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        ...over,
    });

    it('matches Ctrl+Shift+[', () => {
        expect(isFoldShortcut(chord())).toBe(true);
    });

    it('matches Cmd+Shift+[ (macOS)', () => {
        expect(isFoldShortcut(chord({ ctrlKey: false, metaKey: true }))).toBe(true);
    });

    it('matches by layout-stable code when key is not "["', () => {
        // On layouts where Shift+[ yields another character, `key` differs but
        // `code` is still BracketLeft.
        expect(isFoldShortcut(chord({ key: 'è' }))).toBe(true);
    });

    it('requires Shift', () => {
        expect(isFoldShortcut(chord({ shiftKey: false }))).toBe(false);
    });

    it('requires Cmd or Ctrl', () => {
        expect(isFoldShortcut(chord({ ctrlKey: false, metaKey: false }))).toBe(false);
    });

    it('rejects when Alt is held (must not shadow Alt chords)', () => {
        expect(isFoldShortcut(chord({ altKey: true }))).toBe(false);
    });

    it('rejects an unrelated key', () => {
        expect(isFoldShortcut(chord({ key: ']', code: 'BracketRight' }))).toBe(false);
    });
});

describe('hiddenByFoldedSections', () => {
    it('hides nothing when no nested heading is folded', () => {
        // Section of "# A": a paragraph, then an unfolded "## B" and its para.
        const section = [para(), heading(2, false), para()];
        expect(hiddenByFoldedSections(section)).toEqual([false, false, false]);
    });

    it('hides blocks owned by a still-folded nested heading (not its own line)', () => {
        // "## B" is folded: its own line stays visible, its paragraph is hidden.
        const section = [para(), heading(2, true), para()];
        expect(hiddenByFoldedSections(section)).toEqual([false, false, true]);
    });

    it('stops hiding at a heading that closes the folded region', () => {
        // folded ## B, its para (hidden), then ## C at the same level reopens.
        const section = [heading(2, true), para(), heading(2, false), para()];
        expect(hiddenByFoldedSections(section)).toEqual([false, true, false, false]);
    });

    it('keeps deeper headings under a folded ancestor hidden', () => {
        // folded ## B owns everything deeper until the next level <= 2.
        const section = [heading(2, true), para(), heading(3, false), para()];
        expect(hiddenByFoldedSections(section)).toEqual([false, true, true, true]);
    });
});

describe('fold boundaries after structure changes', () => {
    it.each([
        { blocks: [], hidden: [] },
        { blocks: [heading(1, true), para(), para()], hidden: [false, true, true] },
        { blocks: [heading(2, true), para(), heading(1), para()], hidden: [false, true, false, false] },
        { blocks: [heading(1, true), para(), { blockName: 'setext-heading', level: 1 }, para()], hidden: [false, true, false, false] },
        { blocks: [heading(2, true), heading(3, true), para(), heading(2), para()], hidden: [false, true, true, false, false] },
        { blocks: [heading(1, true), { blockName: 'atx-heading' }, para()], hidden: [false, true, true] },
    ])('resolves $blocks', ({ blocks, hidden }) => {
        expect(hiddenByFoldedSections(blocks)).toEqual(hidden);
    });
});
