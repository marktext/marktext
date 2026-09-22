export interface HeadingPosition {
  slug: string
  /** Vertical position, in the same coordinate space as the cursor. */
  top: number
}

/**
 * The slug of the last heading at or above `cursorTop` — the section the cursor
 * is in — or `null` when it sits above every heading.
 *
 * `headings` must be in document order, and their `top` must share a coordinate
 * space with `cursorTop`; the caller compares viewport coordinates read within
 * a single event, so no scroll arithmetic is involved.
 */
export function findActiveHeadingSlug(
  headings: ReadonlyArray<HeadingPosition>,
  cursorTop: number
): string | null {
  if (headings.length === 0) return null

  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].top <= cursorTop) {
      return headings[i].slug
    }
  }

  return null
}
