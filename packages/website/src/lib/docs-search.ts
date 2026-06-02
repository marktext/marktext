export type IndexedHeading = { id: string; text: string; depth: 2 | 3 }
export type IndexedPage = {
  slug: string
  href: string
  title: string
  tab: 'user' | 'dev'
  tabLabel: string
  group: string
  hint?: string
  headings: IndexedHeading[]
  body: string
}

export type SearchHit = {
  page: IndexedPage
  score: number
  /** Plain-text snippet — typically the hint or a body prefix. Safe to render as text. */
  snippet: string
  /** Pre-highlighted HTML snippet with `<mark>` — present only when a body match drove it. */
  snippetHtml?: string
  /** Optional matched heading id — Enter navigates to title#id when present. */
  headingId?: string
}

let cache: Promise<IndexedPage[]> | null = null

export async function loadIndex(): Promise<IndexedPage[]> {
  if (!cache) {
    cache = fetch('/docs-index.json', { cache: 'force-cache' })
      .then((r) => {
        if (!r.ok) throw new Error('failed to load docs index')
        return r.json() as Promise<IndexedPage[]>
      })
      .catch((err) => {
        cache = null
        throw err
      })
  }
  return cache
}

type Lc = { title: string; group: string; hint: string; body: string; headings: string[] }
const lcCache = new WeakMap<IndexedPage, Lc>()
function lc(page: IndexedPage): Lc {
  let v = lcCache.get(page)
  if (!v) {
    v = {
      title: page.title.toLowerCase(),
      group: page.group.toLowerCase(),
      hint: page.hint?.toLowerCase() ?? '',
      body: page.body.toLowerCase(),
      headings: page.headings.map((h) => h.text.toLowerCase())
    }
    lcCache.set(page, v)
  }
  return v
}

const TOKEN_RE = /\S+/g

export function search(query: string, pages: IndexedPage[]): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const terms = Array.from(q.matchAll(TOKEN_RE), (m) => m[0])
  if (terms.length === 0) return []

  const hits: SearchHit[] = []
  for (const page of pages) {
    const result = scorePage(page, q, terms)
    if (result) hits.push(result)
  }
  hits.sort((a, b) => b.score - a.score)
  return hits.slice(0, 40)
}

function scorePage(page: IndexedPage, q: string, terms: string[]): SearchHit | null {
  const lcp = lc(page)
  let score = 0
  let matched = false
  let matchedHeading: IndexedHeading | undefined
  let snippetHtml: string | undefined

  if (lcp.title === q) {
    score += 1000
    matched = true
  } else if (lcp.title.startsWith(q)) {
    score += 600
    matched = true
  } else if (lcp.title.includes(q)) {
    score += 400
    matched = true
  }

  for (const term of terms) {
    if (lcp.title.includes(term)) {
      score += 120
      matched = true
    }
    if (lcp.hint.includes(term)) {
      score += 60
      matched = true
    }
    if (lcp.group.includes(term)) {
      score += 30
      matched = true
    }
    for (let i = 0; i < page.headings.length; i++) {
      if (lcp.headings[i].includes(term)) {
        const h = page.headings[i]
        score += h.depth === 2 ? 80 : 50
        matched = true
        if (!matchedHeading) matchedHeading = h
      }
    }
    const bodyIdx = lcp.body.indexOf(term)
    if (bodyIdx !== -1) {
      score += 15
      matched = true
      if (!matchedHeading && !snippetHtml) snippetHtml = highlight(page.body, bodyIdx, term.length)
    }
  }

  if (!matched) return null
  return {
    page,
    score,
    snippet: page.hint ?? truncate(page.body, 120),
    snippetHtml,
    headingId: matchedHeading?.id
  }
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1).trimEnd() + '…'
}

function highlight(text: string, start: number, length: number): string {
  const radius = 50
  const from = Math.max(0, start - radius)
  const to = Math.min(text.length, start + length + radius)
  const before = (from > 0 ? '…' : '') + text.slice(from, start)
  const mid = text.slice(start, start + length)
  const after = text.slice(start + length, to) + (to < text.length ? '…' : '')
  return escapeHtml(before) + '<mark>' + escapeHtml(mid) + '</mark>' + escapeHtml(after)
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;'
  )
}
