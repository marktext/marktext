// Index-cursor → block-key cursor conversion for the source-code → WYSIWYG
// handoff. The desktop app hands back only a CodeMirror `{ line, ch }` offset
// pair when switching a tab from source mode to WYSIWYG; this resolves those
// offsets against the live block tree to recover the caret's block-key cursor.

import type Content from '../block/base/content';
import type { ScrollPage } from '../block/scrollPage';
import type { TState } from '../state/types';
import type { IPathCursor, ISelection } from './types';

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
// The markdown parser strips non-ASCII control/PUA characters, so the markers
// are plain ASCII with a long random-looking token unlikely to occur in real
// documents. The two markers share no common substring so neither can be
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
 * a PATH-ONLY `IPathCursor` (json paths + offsets), or `null` when neither sentinel
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
 * the anchor sentinel precedes it in the same block.
 */
export function resolveSentinelCursor(scrollPage: ScrollPage): IPathCursor | null {
    const anchorHit = _findSentinel(scrollPage, ANCHOR_SENTINEL);
    const focusHit = _findSentinel(scrollPage, FOCUS_SENTINEL);

    if (!anchorHit && !focusHit)
        return null;

    const anchor = anchorHit ?? focusHit!;
    const focus = focusHit ?? anchorHit!;

    let anchorOffset = anchor.offset;
    let focusOffset = focus.offset;

    // When both sentinels live in the same block, the second one's recorded
    // offset is shifted by the first sentinel's length. Normalize so both
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

// INVERSE direction: WYSIWYG block-key selection -> source `{ line, ch }` index
// cursor, reusing the same sentinel/serialize path as the forward conversion.

/**
 * Walk a (cloned) state tree along a content block's json1 `path` — which ends
 * in the `'text'` key — and splice `sentinel` into that block's text at
 * `offset` (clamped). Returns `false` when the path does not resolve to a node
 * carrying a string `text` field (e.g. a non-content block), so the caller can
 * bail out. Mutates `state` in place; the caller passes a throwaway clone.
 */
function _injectSentinelAtPath(
    state: TState[],
    path: (string | number)[],
    offset: number,
    sentinel: string,
): boolean {
    if (path.length === 0)
        return false;

    // Navigate to the parent node that owns the final key.
    let node: unknown = state;
    for (let i = 0; i < path.length - 1; i++) {
        if (node == null || typeof node !== 'object')
            return false;
        node = (node as Record<string | number, unknown>)[path[i]!];
    }

    const key = path[path.length - 1]!;
    if (node == null || typeof node !== 'object')
        return false;

    const holder = node as Record<string | number, unknown>;
    const text = holder[key];
    if (typeof text !== 'string')
        return false;

    const at = _clampOffset(offset, text.length);
    holder[key] = text.substring(0, at) + sentinel + text.substring(at);

    return true;
}

/**
 * Inject the anchor/focus sentinels into a cloned `state` tree at the block
 * paths + offsets of `selection`. Returns the mutated state, or `null` when
 * neither endpoint resolves to a content block's text (so the caret can't be
 * located in the serialized markdown).
 *
 * When anchor and focus share a block, the sentinel at the SMALLER offset is
 * injected first (unshifted) and the one at the larger offset second, with its
 * offset bumped by the first sentinel's length — handling both forward and
 * backward selections. `_injectSentinelAtPath` re-reads the text on each call,
 * so injecting the earlier one first keeps the later offset valid.
 */
export function injectStateSentinels(
    state: TState[],
    selection: ISelection,
): TState[] | null {
    const anchorPath = selection.anchor.path;
    const focusPath = selection.focus.path;
    const anchorOffset = selection.anchor.offset;
    const focusOffset = selection.focus.offset;

    const sameBlock
        = anchorPath.length === focusPath.length
            && anchorPath.every((seg, i) => seg === focusPath[i]);

    const inject = (
        path: (string | number)[],
        offset: number,
        sentinel: string,
    ): boolean => _injectSentinelAtPath(state, path, offset, sentinel);

    if (!sameBlock) {
        // Different blocks (or different lines): the injections never overlap.
        const anchorOk = inject(anchorPath, anchorOffset, ANCHOR_SENTINEL);
        const focusOk = inject(focusPath, focusOffset, FOCUS_SENTINEL);

        return anchorOk || focusOk ? state : null;
    }

    // Same block: inject the earlier offset first (unshifted), then the later
    // one shifted by the first sentinel's length.
    let ok: boolean;
    if (anchorOffset <= focusOffset) {
        ok = inject(anchorPath, anchorOffset, ANCHOR_SENTINEL);
        ok = inject(focusPath, focusOffset + ANCHOR_SENTINEL.length, FOCUS_SENTINEL) || ok;
    }
    else {
        ok = inject(focusPath, focusOffset, FOCUS_SENTINEL);
        ok = inject(anchorPath, anchorOffset + FOCUS_SENTINEL.length, ANCHOR_SENTINEL) || ok;
    }

    return ok ? state : null;
}

/**
 * Count the `\n` characters in `markdown` before `idx` (= the 0-based line of
 * `idx`) without allocating an intermediate array — this can run on large
 * documents. `lastIndexOf` is a native scan, so the column is cheap too.
 */
function _lineColAt(markdown: string, idx: number): IIndexPosition {
    let line = 0;
    for (let i = 0; i < idx; i++) {
        if (markdown.charCodeAt(i) === 10 /* \n */)
            line++;
    }
    const lastNewline = markdown.lastIndexOf('\n', idx - 1);

    return { line, ch: idx - (lastNewline + 1) };
}

/** Locate `sentinel` in `markdown` and return its `{ line, ch }`, or `null`. */
function _findOffsetInMarkdown(
    markdown: string,
    sentinel: string,
): IIndexPosition | null {
    const idx = markdown.indexOf(sentinel);
    if (idx === -1)
        return null;

    return _lineColAt(markdown, idx);
}

/**
 * Read the sentinel positions back out of the serialized (sentinel-bearing)
 * `markdown` into an `{ line, ch }` index cursor. Returns `null` when a
 * sentinel that was injected cannot be found (e.g. a serializer dropped the
 * surrounding text). Removes both sentinels from the line/ch accounting: the
 * focus position is corrected for any earlier-occurring anchor sentinel.
 */
export function locateSentinelOffsets(markdown: string): IIndexCursor | null {
    const anchorRaw = _findOffsetInMarkdown(markdown, ANCHOR_SENTINEL);
    const focusRaw = _findOffsetInMarkdown(markdown, FOCUS_SENTINEL);

    if (!anchorRaw && !focusRaw)
        return null;

    // Compute each sentinel's flat index so we can subtract the length of any
    // OTHER sentinel that precedes it (sentinels never share the same index).
    const anchorIdx = markdown.indexOf(ANCHOR_SENTINEL);
    const focusIdx = markdown.indexOf(FOCUS_SENTINEL);

    const cleanLineCh = (
        raw: IIndexPosition | null,
        ownIdx: number,
        otherIdx: number,
        otherLen: number,
    ): IIndexPosition | null => {
        if (!raw)
            return null;
        // Only same-line earlier sentinels shift `ch`; earlier-line ones don't.
        if (otherIdx !== -1 && otherIdx < ownIdx) {
            const otherLine = _lineColAt(markdown, otherIdx).line;
            if (otherLine === raw.line)
                return { line: raw.line, ch: raw.ch - otherLen };
        }

        return raw;
    };

    const anchor = cleanLineCh(anchorRaw, anchorIdx, focusIdx, FOCUS_SENTINEL.length);
    const focus = cleanLineCh(focusRaw, focusIdx, anchorIdx, ANCHOR_SENTINEL.length);

    return {
        anchor: anchor ?? focus,
        focus: focus ?? anchor,
    };
}
