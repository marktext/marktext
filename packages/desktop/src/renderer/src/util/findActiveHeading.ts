// Given a list of heading positions (slug + vertical offset) and a cursor
// position, returns the slug of the heading the cursor is "inside" — i.e. the
// last heading whose top is at or above the cursor. This drives the TOC sidebar
// highlight: the user sees which section they're editing without looking at the
// scroll position.
//
// The entries MUST be in document order (top-to-bottom). Both `offsetTop` values
// and `cursorTop` must be in the SAME coordinate space (e.g. document-relative:
// `element.offsetTop` within the scroll container, and cursor =
// `scrollTop + viewportY - container.getBoundingClientRect().top`).

export interface HeadingPosition {
  slug: string
  offsetTop: number
}

/**
 * Finds the slug of the heading that "owns" the given cursor position.
 *
 * @param headings Heading positions sorted in document order (top-to-bottom).
 * @param cursorTop Cursor's document-relative vertical offset.
 * @returns The slug of the last heading at or above the cursor, or `null` if
 *   there are no headings or the cursor is above all of them.
 */
export function findActiveHeadingSlug(
  headings: ReadonlyArray<HeadingPosition>,
  cursorTop: number
): string | null {
  if (headings.length === 0) return null

  // Walk backwards: the first heading whose top ≤ cursorTop is the active one.
  // Reverse iteration is O(1) for the common case (cursor is near the end).
  for (let i = headings.length - 1; i >= 0; i--) {
    if (headings[i].offsetTop <= cursorTop) {
      return headings[i].slug
    }
  }

  // Cursor is above all headings (e.g. in frontmatter before the first heading).
  return null
}
