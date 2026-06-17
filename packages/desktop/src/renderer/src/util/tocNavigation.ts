// Maps a sidebar TOC entry (its slug) onto the matching heading element in the
// live editor DOM, so the caller can scroll it into view.
//
// `@muyajs/core` slugs are stable per-block ids that are NOT stamped onto the
// heading DOM, so a `#slug` selector never matches. `getTOC` instead enumerates
// the headings in document order, so we resolve the slug to its index in that
// list and pick the heading at the same index in the DOM.
//
// The DOM query MUST match the exact set `getTOC` enumerates. `getTOC` only
// walks top-level `scrollPage` children (it does not recurse), and those blocks
// are the DIRECT children of the scrollPage root element (`.mu-container`).
// Note the scroll container we get from the host (`getScrollContainer()`,
// i.e. muya's root `.mu-editor`) WRAPS `.mu-container` — the headings are one
// level deeper — so we anchor on `.mu-container > hN` rather than the scroll
// container's own direct children. Headings nested in blockquotes / list items,
// or `<h1>`-`<h6>` inside raw-HTML blocks, are NOT direct children of
// `.mu-container`; an unscoped `querySelectorAll('h1..h6')` would count them and
// shift every later index, scrolling to the wrong heading.
export const TOP_LEVEL_HEADINGS_SELECTOR =
  '.mu-container > h1, .mu-container > h2, .mu-container > h3, .mu-container > h4, .mu-container > h5, .mu-container > h6'

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
