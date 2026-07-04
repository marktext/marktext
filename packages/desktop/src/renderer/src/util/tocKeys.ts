export interface KeyedTocNode {
  key: string
  label: unknown
  slug: unknown
  children: KeyedTocNode[]
}

interface TocLike {
  label?: unknown
  slug?: unknown
  githubSlug?: unknown
  children?: TocLike[]
}

// Give each TOC node a stable key so el-tree can preserve the user's
// expand/collapse state. The key is the heading's content-derived `githubSlug`,
// deduplicated in document order so duplicate headings stay distinct. This is
// stable across content edits (#3028) AND across a document reload / tab switch
// (#3791) — unlike the per-render object id `slug`, which every switch rebuilds.
// `slug` is still carried for the click-to-scroll anchor payload.
export function deriveKeyedToc(nodes: TocLike[]): KeyedTocNode[] {
  const seen = new Map<string, number>()
  const assign = (list: TocLike[]): KeyedTocNode[] =>
    list.map((node) => {
      const base =
        typeof node.githubSlug === 'string' && node.githubSlug ? node.githubSlug : 'heading'
      const count = seen.get(base) ?? 0
      seen.set(base, count + 1)
      return {
        key: count === 0 ? base : `${base}-${count}`,
        label: node.label,
        slug: node.slug,
        children: assign(node.children ?? [])
      }
    })
  return assign(nodes)
}
