// Pure, DOM-free helpers for heading-fold section resolution.
//
// A "section" owned by a heading is every block that follows it in document
// order up to (but not including) the next heading of an equal-or-higher level
// (i.e. a smaller-or-equal `level` number). These helpers operate on a minimal
// structural view of the sibling list so they can be unit-tested without a
// live muya tree or a DOM.

export interface IFoldSibling {
    /** `atx-heading` for headings, any other block name otherwise. */
    blockName: string;
    /** Heading level 1..6 for headings; undefined for non-heading blocks. */
    level?: number;
}

/**
 * Given the level of the heading being folded and the list of blocks that
 * follow it (in document order), return the indices of the blocks that belong
 * to the heading's section.
 *
 * The section ends at the first sibling that is a heading with a level less
 * than or equal to `headingLevel`. That terminating heading and everything
 * after it are NOT part of the section.
 *
 * Non-heading blocks and deeper (higher-numbered level) headings ARE part of
 * the section, so folding an `h1` also hides the `h2`/`h3` beneath it.
 */
export function collectSectionIndices(
    headingLevel: number,
    followingSiblings: IFoldSibling[],
): number[] {
    const indices: number[] = [];

    for (let i = 0; i < followingSiblings.length; i++) {
        const sibling = followingSiblings[i];
        const isHeading = sibling.blockName === 'atx-heading';

        if (
            isHeading
            && typeof sibling.level === 'number'
            && sibling.level <= headingLevel
        ) {
            break;
        }

        indices.push(i);
    }

    return indices;
}

/**
 * A section is "empty" when the heading is immediately followed by another
 * heading of equal-or-higher level (or by nothing at all) — folding it hides
 * no content, so the affordance should be treated as a no-op.
 */
export function isEmptySection(
    headingLevel: number,
    followingSiblings: IFoldSibling[],
): boolean {
    return collectSectionIndices(headingLevel, followingSiblings).length === 0;
}

/** The subset of `KeyboardEvent` the fold shortcut needs — keeps this helper
 * pure and unit-testable with a plain object instead of a real DOM event. */
export interface IFoldKeyChord {
    key: string;
    code: string;
    shiftKey: boolean;
    metaKey: boolean;
    ctrlKey: boolean;
    altKey: boolean;
}

/**
 * Is this keystroke the "fold this section" shortcut?
 *
 * The chord is `Cmd+Shift+[` on macOS and `Ctrl+Shift+[` elsewhere, matching
 * the VS Code "fold" convention. We accept the bracket either by `key` ('[',
 * which the major browsers report regardless of Shift) or by the layout-stable
 * `code` ('BracketLeft'), so it still fires on layouts where Shift+[ produces a
 * different character. `Alt` must be up so we don't shadow other Alt chords.
 *
 * Extracted from the keydown handler so the (easy-to-get-wrong) modifier logic
 * can be tested directly, without constructing a DOM `KeyboardEvent`.
 */
export function isFoldShortcut(event: IFoldKeyChord): boolean {
    const isBracket = event.key === '[' || event.code === 'BracketLeft';

    return (
        isBracket
        && event.shiftKey
        && (event.metaKey || event.ctrlKey)
        && !event.altKey
    );
}
