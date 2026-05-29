#!/usr/bin/env tsx
/**
 * Build-time docs search index.
 * Reads every page registered in `src/lib/docs-nav.ts`, strips its markdown
 * down to plain text + headings + title, and emits `public/docs-index.json`.
 *
 * The client palette loads this file lazily on first open.
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import matter from 'gray-matter'
import GithubSlugger from 'github-slugger'
import { ALL_PAGES } from '../src/lib/docs-nav'
import type { IndexedHeading, IndexedPage } from '../src/lib/docs-search'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT_ROOT = path.join(ROOT, 'content', 'docs')
const OUT_PATH = path.join(ROOT, 'public', 'docs-index.json')

const FENCE_RE = /```[\s\S]*?```/g
const INLINE_RE = /`[^`\n]*`/g
const HTML_TAG_RE = /<[^>]+>/g
const IMG_RE = /!\[[^\]]*\]\([^)]*\)/g
const LINK_RE = /\[([^\]]+)\]\([^)]+\)/g
const URL_RE = /https?:\/\/\S+/g
const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/gm
const WS_RE = /\s+/g

function stripToText(md: string): string {
  return md
    .replace(FENCE_RE, ' ')
    .replace(IMG_RE, ' ')
    .replace(LINK_RE, '$1')
    .replace(URL_RE, ' ')
    .replace(INLINE_RE, ' ')
    .replace(HTML_TAG_RE, ' ')
    .replace(/^\s*>\s?\[![A-Z]+\]/gm, ' ')
    .replace(/^[*_\-+#>|]+/gm, ' ')
    .replace(WS_RE, ' ')
    .trim()
}

function extractHeadings(md: string): IndexedHeading[] {
  const slugger = new GithubSlugger()
  const out: IndexedHeading[] = []
  let m: RegExpExecArray | null
  HEADING_RE.lastIndex = 0
  while ((m = HEADING_RE.exec(md))) {
    const depth = m[1].length
    if (depth < 2 || depth > 3) continue
    const text = m[2].replace(/[`*_]/g, '').trim()
    if (!text) continue
    out.push({ id: slugger.slug(text), text, depth: depth as 2 | 3 })
  }
  return out
}

async function buildIndex(): Promise<IndexedPage[]> {
  const results = await Promise.all(
    ALL_PAGES.map(async (page): Promise<IndexedPage | null> => {
      const full = path.join(CONTENT_ROOT, page.file)
      let raw: string
      try {
        raw = await fs.readFile(full, 'utf8')
      } catch (err) {
        console.warn(`[docs-index] missing source for ${page.file}: ${(err as Error).message}`)
        return null
      }
      const { content } = matter(raw)
      const body = stripToText(content)
      return {
        slug: page.slug.join('/'),
        href: '/docs/' + page.slug.join('/'),
        title: page.title,
        tab: page.tab,
        tabLabel: page.tabLabel,
        group: page.group,
        hint: page.hint,
        headings: extractHeadings(content),
        body: body.length > 3000 ? body.slice(0, 3000) : body
      }
    })
  )
  return results.filter((p): p is IndexedPage => p !== null)
}

async function main() {
  if (process.argv.includes('--if-missing')) {
    try {
      await fs.access(OUT_PATH)
      return
    } catch {
      /* fall through and build */
    }
  }
  const pages = await buildIndex()
  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, JSON.stringify(pages))
  const sizeKb = ((await fs.stat(OUT_PATH)).size / 1024).toFixed(1)
  console.log(`[docs-index] wrote ${pages.length} pages → ${path.relative(ROOT, OUT_PATH)} (${sizeKb} KB)`)
}

main().catch((err) => {
  console.error('[docs-index] failed:', err)
  process.exit(1)
})
