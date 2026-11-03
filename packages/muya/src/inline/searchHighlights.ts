import type { IHighlight, Token } from './model/types';
import { intersectingHighlights } from './model/ranges';
import { tokenEvents } from './model/traversal';

// Annotate a fresh token tree with block-relative search ranges. Parents need
// their own highlights for syntax markers; their children render the content.
// Search supplies ranges with nondecreasing starts and ends.
export function applySearchHighlights(tokens: readonly Token[], highlights: readonly IHighlight[]): void {
    if (!highlights.length)
        return;

    for (const { token, exiting } of tokenEvents(tokens)) {
        if (exiting)
            continue;
        const matches = intersectingHighlights(token.range, highlights);
        if (matches.length)
            token.highlights = matches;
    }
}
