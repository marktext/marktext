// Maps a sidebar TOC entry (its slug) onto the matching heading element in the
// live editor DOM, so the caller can scroll it into view.
//
// `@muyajs/core` slugs are stable per-block ids that are NOT stamped onto the
// heading DOM, so a `#slug` selector never matches. `getTOC` instead enumerates
// the headings in document order, so we resolve the slug to its index in that
// list and pick the heading at the same index in the DOM.
//
// The DOM query MUST match the exact set `getTOC` enumerates. `getTOC` only
// walks top-level `scrollPage` children (it does not recurse), so the query is
// scoped to direct-child headings of the container. Headings nested in
// blockquotes / list items, or `<h1>`-`<h6>` inside raw-HTML blocks, are NOT in
// `getTOC`'s list; an unscoped `querySelectorAll('h1..h6')` would count them and
// shift every later index, scrolling to the wrong heading.
export const TOP_LEVEL_HEADINGS_SELECTOR =
  ':scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > h5, :scope > h6'

export const resolveTocHeadingElement = (
  container: Element,
  listToc: ReadonlyArray<{ slug?: unknown }>,
  slug: unknown
): Element | null => {
  const index = listToc.findIndex((item) => item.slug === slug)
  if (index < 0) return null
  const headings = container.querySelectorAll(TOP_LEVEL_HEADINGS_SELECTOR)
  return headings[index] ?? null
}
