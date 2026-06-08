// Index-cursor → block-key cursor conversion for the source-code → WYSIWYG
// handoff.
//
// PARITY (gap PG2): when the desktop app switches a tab back from source-code
// mode to WYSIWYG, the only cursor it holds is a CodeMirror `{ line, ch }`
// offset pair (`muyaIndexCursor`). Legacy `packages/muyajs` translated that
// into a real block-key cursor by injecting sentinel strings into the markdown
// at the line/ch offsets, re-parsing, and walking the block tree to find which
// block's text the sentinels landed in (`addCursorToMarkdown` +
// `convertMuyaIndexCursortoCursor`). `@muyajs/core` had no equivalent, so the
// WYSIWYG caret was lost on the handoff. This module reproduces that mapping by
// resolving the offsets against the live block tree.

import type Content from '../block/base/content';
import type { ScrollPage } from '../block/scrollPage';
import type { ICursor } from './types';

/** One end of a source-mode (CodeMirror) selection: a `{ line, ch }` offset. */
export interface IIndexPosition {
    line: number;
    ch: number;
}

/** A source-mode selection in CodeMirror `{ line, ch }` coordinates. */
export interface IIndexCursor {
    anchor: IIndexPosition | null;
    focus: IIndexPosition | null;
}

// Sentinel strings injected at the cursor offsets. They must be improbable in
// real markdown AND survive the markdown -> state round-trip as literal text.
// (The legacy engine used private-use-area code points, but this engine's
// markdown parser strips non-ASCII control/PUA characters, so the markers are
// plain ASCII with a long random-looking token unlikely to occur in real
// documents.) The two markers share no common substring so neither can be
// found inside the other.
const ANCHOR_SENTINEL = 'mUyAcUrSoRzZqAnChOr9x7kPvWb';
const FOCUS_SENTINEL = 'mUyAcUrSoRzZqFoCuS4t2nDhGj';

function _clampOffset(offset: number, length: number): number {
    if (!Number.isInteger(offset))
        return 0;

    return Math.min(Math.max(offset, 0), length);
}

/**
 * Inject the anchor/focus sentinels into `markdown` at the given `{ line, ch }`
 * offsets. Returns `null` when either offset references a line that does not
 * exist (stale cursor) so the caller can fall back to no cursor restore.
 */
export function injectSentinels(
    markdown: string,
    cursor: IIndexCursor,
): string | null {
    const { anchor, focus } = cursor;
    if (!anchor || !focus)
        return null;

    const lines = markdown.split('\n');
    const isValidLine = (line: number): boolean =>
        Number.isInteger(line) && line >= 0 && line < lines.length;

    if (!isValidLine(anchor.line) || !isValidLine(focus.line))
        return null;

    const anchorText = lines[anchor.line]!;
    const focusText = lines[focus.line]!;
    const anchorCh = _clampOffset(anchor.ch, anchorText.length);
    const focusCh = _clampOffset(focus.ch, focusText.length);

    if (anchor.line === focus.line) {
        const min = Math.min(anchorCh, focusCh);
        const max = Math.max(anchorCh, focusCh);
        const first = anchorText.substring(0, min);
        const middle = anchorText.substring(min, max);
        const last = anchorText.substring(max);
        lines[anchor.line]
            = first
                + (anchorCh <= focusCh ? ANCHOR_SENTINEL : FOCUS_SENTINEL)
                + middle
                + (anchorCh <= focusCh ? FOCUS_SENTINEL : ANCHOR_SENTINEL)
                + last;
    }
    else {
        lines[anchor.line]
            = anchorText.substring(0, anchorCh) + ANCHOR_SENTINEL + anchorText.substring(anchorCh);
        lines[focus.line]
            = focusText.substring(0, focusCh) + FOCUS_SENTINEL + focusText.substring(focusCh);
    }

    return lines.join('\n');
}

interface ISentinelHit {
    block: Content;
    offset: number;
}

/**
 * Walk the live content blocks of `scrollPage` and, for each sentinel found in
 * a block's text, record the owning block and the offset the sentinel sits at
 * (with the sentinel removed from the offset accounting). The block's text is
 * left untouched — the tree carrying the sentinels is transient and replaced by
 * the caller immediately after.
 */
function _findSentinel(scrollPage: ScrollPage, sentinel: string): ISentinelHit | null {
    let hit: ISentinelHit | null = null;

    scrollPage.depthFirstTraverse((node) => {
        if (hit || !node.isContent())
            return;

        const idx = node.text.indexOf(sentinel);
        if (idx > -1)
            hit = { block: node, offset: idx };
    });

    return hit;
}

/**
 * Resolve the index cursor against the live (sentinel-bearing) block tree into
 * a PATH-ONLY `ICursor` (json paths + offsets), or `null` when neither sentinel
 * resolved to a content block.
 *
 * Only the plain `anchorPath`/`focusPath` arrays are captured (snapshotted from
 * the live blocks here) — NOT the live block references. The caller rebuilds
 * the clean document immediately after, detaching these block instances, so
 * `setCursor` must re-resolve fresh blocks from those paths against the new
 * tree. The structure is identical between the sentinel tree and the clean tree
 * (the sentinels only change text), so the paths stay valid.
 *
 * The returned offsets are sentinel-free: the focus offset is decremented when
 * the anchor sentinel precedes it in the same block, mirroring the legacy
 * two-sentinel bookkeeping.
 */
export function resolveSentinelCursor(scrollPage: ScrollPage): ICursor | null {
    const anchorHit = _findSentinel(scrollPage, ANCHOR_SENTINEL);
    const focusHit = _findSentinel(scrollPage, FOCUS_SENTINEL);

    if (!anchorHit && !focusHit)
        return null;

    const anchor = anchorHit ?? focusHit!;
    const focus = focusHit ?? anchorHit!;

    let anchorOffset = anchor.offset;
    let focusOffset = focus.offset;

    // When both sentinels live in the same block, the second one's recorded
    // offset is shifted by the first sentinel's length. Normalise so both
    // offsets are expressed against the sentinel-free text.
    if (anchor.block === focus.block) {
        if (anchorOffset <= focusOffset)
            focusOffset = Math.max(focusOffset - ANCHOR_SENTINEL.length, anchorOffset);
        else
            anchorOffset = Math.max(anchorOffset - FOCUS_SENTINEL.length, focusOffset);
    }

    // Snapshot the paths now, while the blocks are still attached.
    return {
        anchor: { offset: anchorOffset },
        anchorPath: [...anchor.block.path],
        focus: { offset: focusOffset },
        focusPath: [...focus.block.path],
    };
}
