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
    /** For heading siblings: whether that heading is itself currently folded. */
    folded?: boolean;
}

/** The heading capabilities the fold code needs from a tree node. */
export interface IFoldableHeading {
    blockName: string;
    meta: { level: number };
    folded: boolean;
    toggleFold: (folded?: boolean) => void;
    foldAll: () => void;
    unfoldAll: () => void;
    foldToLevel: (level: number) => void;
}

/**
 * Type guard: is this tree node a foldable ATX heading? Checks the discriminant
 * (`blockName`) plus the presence of the fold API, so callers can narrow a
 * generic tree node to a heading without an unsafe double cast. Structural on
 * purpose — keeps this module free of block-class imports (and import cycles).
 */
export function isFoldableHeading(
    node: unknown,
): node is IFoldableHeading {
    return (
        typeof node === 'object'
        && node !== null
        && (node as { blockName?: unknown }).blockName === 'atx-heading'
        && typeof (node as { toggleFold?: unknown }).toggleFold === 'function'
    );
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
 * When a heading is UNFOLDED, not every block in its section should become
 * visible again: any block owned by a nested heading that is still folded must
 * stay hidden. Given the heading's section blocks in document order (each with
 * a `folded` flag on heading entries), return, per index, whether that block
 * must remain hidden.
 *
 * Walk the section tracking the shallowest still-folded nested heading we are
 * "inside": once we pass a folded heading at level L, every following block is
 * hidden until we reach a heading with level <= L (which closes that folded
 * region). A folded heading's own line stays visible (you still see the
 * collapsed heading); only the blocks it owns are hidden.
 */
export function hiddenByFoldedDescendant(
    sectionBlocks: IFoldSibling[],
): boolean[] {
    // Level of the active folded region, or null when not inside one.
    let foldedRegionLevel: number | null = null;

    return sectionBlocks.map((block) => {
        const isHeading = block.blockName === 'atx-heading';
        const level = typeof block.level === 'number' ? block.level : undefined;

        // A heading at or above the active region closes it (this heading and
        // what follows are no longer inside the folded descendant).
        if (
            isHeading
            && foldedRegionLevel !== null
            && level !== undefined
            && level <= foldedRegionLevel
        ) {
            foldedRegionLevel = null;
        }

        const hidden = foldedRegionLevel !== null;

        // A still-folded heading opens a new hidden region for the blocks it
        // owns. Its own line is not hidden by this rule.
        if (isHeading && block.folded && level !== undefined) {
            if (foldedRegionLevel === null || level <= foldedRegionLevel)
                foldedRegionLevel = level;
        }

        return hidden;
    });
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

/**
 * The subset of `KeyboardEvent` the fold shortcut needs — keeps this helper
 * pure and unit-testable with a plain object instead of a real DOM event.
 */
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

/**
 * Plan a document-wide fold "to a level": decide, for every heading, whether it
 * should end up folded.
 *
 * The rule is intentionally simple and per-heading: a heading folds when its
 * level is deeper than `targetLevel` (a larger level number), and unfolds when
 * it is at or above the target. So `foldPlanForLevel(2, ...)` keeps h1/h2 open
 * and folds h3–h6 — leaving a table-of-contents view down to level 2.
 *
 * Callers derive the common actions from this one helper:
 *   - "Fold all"   → targetLevel 1 (only top-level h1s stay open)
 *   - "Unfold all" → targetLevel 6 (nothing is deeper than 6, so all open)
 *   - "Fold to this level" → the level of the heading the user clicked
 *
 * Whether a folded heading's own content is actually visible on screen is left
 * to the section CSS cascade (a folded ancestor hides its descendants); this
 * function only decides each heading's own fold flag.
 *
 * @param targetLevel The deepest level that should remain unfolded (1..6).
 * @param headingLevels Levels of every heading in the document, in order.
 * @returns For each heading (same order), `true` = fold, `false` = unfold.
 */
export function foldPlanForLevel(
    targetLevel: number,
    headingLevels: number[],
): boolean[] {
    return headingLevels.map(level => level > targetLevel);
}
