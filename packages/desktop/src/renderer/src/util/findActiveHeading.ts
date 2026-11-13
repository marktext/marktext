export interface HeadingPosition {
  slug: string
  /** Live vertical position in the cursor's coordinate space; null for headings without client rects. */
  top: number | null
}

/**
 * The slug of the last heading at or above `cursorTop` — the section the cursor
 * is in — or `null` when it sits above every heading.
 *
 * Visible headings must have nondecreasing `top` values in document order.
 * `top` may be a getter so only probed headings need layout reads.
 */
export function findActiveHeadingSlug(
  headings: ReadonlyArray<HeadingPosition>,
  cursorTop: number
): string | null {
  let low = 0
  let high = headings.length - 1
  let activeSlug: string | null = null

  while (low <= high) {
    const mid = Math.floor((low + high) / 2)
    let probe = mid
    let top = headings[probe].top
    // A hidden heading has no ordered position. Discard its scanned range
    // with this iteration so it is never probed again.
    while (top === null && probe > low) {
      probe--
      top = headings[probe].top
    }
    if (top === null) {
      low = mid + 1
    } else if (top <= cursorTop) {
      activeSlug = headings[probe].slug
      low = mid + 1
    } else {
      high = probe - 1
    }
  }

  return activeSlug
}
