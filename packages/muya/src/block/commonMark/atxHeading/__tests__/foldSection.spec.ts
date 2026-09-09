import { describe, expect, it } from 'vitest';
import { collectSectionIndices, foldPlanForLevel, isEmptySection, isFoldShortcut } from '../foldSection';
import type { IFoldKeyChord, IFoldSibling } from '../foldSection';

// Structural fixtures: a heading fold section is every following block up to
// (but excluding) the next heading of an equal-or-higher level.
const para = (): IFoldSibling => ({ blockName: 'paragraph' });
const heading = (level: number): IFoldSibling => ({
    blockName: 'atx-heading',
    level,
});

describe('collectSectionIndices', () => {
    it('collects trailing non-heading blocks', () => {
        const siblings = [para(), para(), para()];
        expect(collectSectionIndices(1, siblings)).toEqual([0, 1, 2]);
    });

    it('stops at the next heading of the same level', () => {
        // # A  <- folding this (level 1)
        //   para, para
        // # B  <- same level, ends the section
        const siblings = [para(), para(), heading(1), para()];
        expect(collectSectionIndices(1, siblings)).toEqual([0, 1]);
    });

    it('stops at the next heading of a higher level (smaller number)', () => {
        // ## A (level 2) followed by an h1 ends the section immediately.
        const siblings = [heading(1)];
        expect(collectSectionIndices(2, siblings)).toEqual([]);
    });

    it('includes deeper headings (nested h2/h3 under a folded h1)', () => {
        // # A (level 1): everything down to the next h1 is part of the section,
        // including the h2 and its paragraph.
        const siblings = [para(), heading(2), para(), heading(3), para(), heading(1)];
        expect(collectSectionIndices(1, siblings)).toEqual([0, 1, 2, 3, 4]);
    });

    it('returns an empty section when immediately followed by a same-level heading', () => {
        const siblings = [heading(2), para()];
        expect(collectSectionIndices(2, siblings)).toEqual([]);
    });

    it('returns an empty section when there are no following siblings', () => {
        expect(collectSectionIndices(3, [])).toEqual([]);
    });

    it('treats a heading with an undefined level as a non-terminating block', () => {
        // Defensive: a malformed heading sibling without a level must not end
        // the section (it is simply hidden along with the rest).
        const siblings: IFoldSibling[] = [{ blockName: 'atx-heading' }, para()];
        expect(collectSectionIndices(1, siblings)).toEqual([0, 1]);
    });
});

describe('isEmptySection', () => {
    it('is true when the heading owns no content', () => {
        expect(isEmptySection(1, [heading(1)])).toBe(true);
        expect(isEmptySection(2, [])).toBe(true);
    });

    it('is false when the heading owns at least one block', () => {
        expect(isEmptySection(1, [para(), heading(1)])).toBe(false);
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

describe('foldPlanForLevel', () => {
    // Document outline: h1, h2, h3, h1, h2 → levels [1,2,3,1,2].
    const levels = [1, 2, 3, 1, 2];

    it('fold all (level 1): folds everything deeper than h1', () => {
        // Only the h1s stay unfolded.
        expect(foldPlanForLevel(1, levels)).toEqual([false, true, true, false, true]);
    });

    it('fold to level 2: keeps h1/h2 open, folds h3+', () => {
        expect(foldPlanForLevel(2, levels)).toEqual([false, false, true, false, false]);
    });

    it('unfold all (level 6): nothing is deeper, so all open', () => {
        expect(foldPlanForLevel(6, levels)).toEqual([false, false, false, false, false]);
    });

    it('returns an empty plan for a document with no headings', () => {
        expect(foldPlanForLevel(1, [])).toEqual([]);
    });
});
